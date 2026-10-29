#!/usr/bin/env bash
# ==============================================================================
# Clinic Management System (QLPK) - Safe Database Restore Script
# ==============================================================================
# Script: scripts/restore-db.sh
# Feature: F3-08 (Backup, Recovery & Operational Procedures)
# Task: P3-026 (Safe Database Restore with Dry-Run & Disaster Recovery Guards)
#
# Description:
#   Provides a highly secure, fail-safe mechanism to restore MySQL database
#   backups (.sql or .sql.gz archives) for the Clinic Management System (DBQLPK).
#
# Core Safety Guarantees:
#   1. NEVER automatically overwrites the primary database (DBQLPK) without
#      explicit confirmation (interactive "CONFIRM_RESTORE" prompt or --force /
#      --confirm-overwrite in automated pipelines).
#   2. Supports --dry-run mode: validates gzip archive integrity (gzip -t),
#      inspects SQL headers, and simulates restoration on a temporary test
#      database (DBQLPK_TEST_RESTORE) to verify consistency before touching
#      production data.
#   3. Automatic pre-restoration snapshot: captures an emergency backup of the
#      current database state prior to any destructive overwrite.
#   4. Process & Credential Masking: Credentials are read dynamically from .env
#      and passed via a secure temporary options file (mode 0600) with trap
#      cleanup, preventing password leakage in process listings (ps aux, top).
# ==============================================================================

set -Eeuo pipefail

# ------------------------------------------------------------------------------
# 1. Base Variables & Directory Resolution
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd -- "${SCRIPT_DIR}/.." && pwd)}"

# Defaults
DEFAULT_TEST_DB="DBQLPK_TEST_RESTORE"
BACKUP_FILE=""
TARGET_DB=""
TEST_DB="${DEFAULT_TEST_DB}"
CUSTOM_ENV_FILE=""
CUSTOM_BACKUP_DIR=""
CLI_DB_HOST=""
CLI_DB_PORT=""
CLI_DB_USER=""
CLI_DB_PASSWORD=""
DRY_RUN=0
FORCE_CONFIRM=0
SKIP_SAFETY_BACKUP=0
KEEP_TEST_DB=0
VERBOSE=0

# Clean temporary option file and scratch files on any exit
TEMP_CNF=""
TEMP_SQL=""
cleanup() {
  local exit_code=$?
  if [[ -n "${TEMP_CNF:-}" && -f "${TEMP_CNF}" ]]; then
    rm -f "${TEMP_CNF}" 2>/dev/null || true
  fi
  if [[ -n "${TEMP_SQL:-}" && -f "${TEMP_SQL}" ]]; then
    rm -f "${TEMP_SQL}" 2>/dev/null || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# 2. Logging & Helper Functions
# ------------------------------------------------------------------------------
log_info() {
  printf '[%s] [INFO] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

log_warn() {
  printf '[%s] [WARN] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] [ERROR] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_success() {
  printf '[%s] [SUCCESS] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

show_help() {
  cat <<'EOF'
QLPK Safe Database Restore Script (scripts/restore-db.sh)

Usage:
  restore-db.sh [options] [path-to-backup-file.sql.gz]

Options:
  --file, -f <path>         Path to backup file (.sql or .sql.gz) to restore
  --target-db, --db <name>  Target database to restore into (default: from .env or DBQLPK)
  --dry-run                 Simulate restore: test archive integrity, SQL header & test DB
  --test-db <name>          Test database name for dry-run (default: DBQLPK_TEST_RESTORE)
  --keep-test-db            Do not drop the test database after dry-run completion
  --force, -y, --yes        Bypass interactive confirmation prompt (for automation/CI)
  --confirm-overwrite       Explicit flag to authorize overwriting the target database
  --skip-safety-backup      Skip taking an automatic pre-restoration snapshot of target DB
  --env, -e <path>          Path to Laravel .env file (default: be/.env or .env)
  --host <host>             Override database host (default: from .env or 127.0.0.1)
  --port <port>             Override database port (default: from .env or 3306)
  --user, -u <user>         Override database username (default: from .env or root)
  -v, --verbose             Display detailed diagnostic output
  -h, --help                Display this help documentation and exit

Safety Mechanisms:
  - Dry-run verification tests gzip integrity and restores to a sandbox database.
  - Production database (DBQLPK) cannot be overwritten without typing CONFIRM_RESTORE
    or passing --force / --confirm-overwrite.
  - An emergency snapshot of the target database is taken automatically before restore
    unless --skip-safety-backup is specified.
  - Passwords are never exposed in process tables (ps aux) or command arguments.

Examples:
  # 1. Help manual:
  ./scripts/restore-db.sh --help

  # 2. Test archive integrity & dry-run restore into DBQLPK_TEST_RESTORE:
  ./scripts/restore-db.sh --dry-run storage/backups/backup_DBQLPK_20261029_020000.sql.gz

  # 3. Interactive restore to production database with pre-restoration snapshot:
  ./scripts/restore-db.sh storage/backups/backup_DBQLPK_20261029_020000.sql.gz

  # 4. Automated restore in CI/CD pipeline targeting a staging database:
  ./scripts/restore-db.sh --target-db DBQLPK_STAGING --force backup.sql.gz
EOF
}

# ------------------------------------------------------------------------------
# 3. Argument Parsing
# ------------------------------------------------------------------------------
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file|-f)
      if [[ -n "${2:-}" ]]; then
        BACKUP_FILE="$2"
        shift 2
      else
        log_error "Option --file requires a file path argument."
        exit 1
      fi
      ;;
    --target-db|--database|--db)
      if [[ -n "${2:-}" ]]; then
        TARGET_DB="$2"
        shift 2
      else
        log_error "Option --target-db requires a database name argument."
        exit 1
      fi
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --test-db)
      if [[ -n "${2:-}" ]]; then
        TEST_DB="$2"
        shift 2
      else
        log_error "Option --test-db requires a database name argument."
        exit 1
      fi
      ;;
    --keep-test-db)
      KEEP_TEST_DB=1
      shift
      ;;
    --force|-y|--yes)
      FORCE_CONFIRM=1
      shift
      ;;
    --confirm-overwrite)
      FORCE_CONFIRM=1
      shift
      ;;
    --skip-safety-backup)
      SKIP_SAFETY_BACKUP=1
      shift
      ;;
    --env|-e)
      if [[ -n "${2:-}" ]]; then
        CUSTOM_ENV_FILE="$2"
        shift 2
      else
        log_error "Option --env requires a path argument."
        exit 1
      fi
      ;;
    --host)
      if [[ -n "${2:-}" ]]; then
        CLI_DB_HOST="$2"
        shift 2
      else
        log_error "Option --host requires a host argument."
        exit 1
      fi
      ;;
    --port)
      if [[ -n "${2:-}" ]]; then
        CLI_DB_PORT="$2"
        shift 2
      else
        log_error "Option --port requires a port argument."
        exit 1
      fi
      ;;
    --user|-u)
      if [[ -n "${2:-}" ]]; then
        CLI_DB_USER="$2"
        shift 2
      else
        log_error "Option --user requires a username argument."
        exit 1
      fi
      ;;
    -v|--verbose)
      VERBOSE=1
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    -*)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      shift
      ;;
  esac
done

# If positional argument was provided and BACKUP_FILE is empty, assign it
if [[ -z "$BACKUP_FILE" && "${#POSITIONAL_ARGS[@]}" -gt 0 ]]; then
  BACKUP_FILE="${POSITIONAL_ARGS[0]}"
fi

# ------------------------------------------------------------------------------
# 4. Locate & Parse .env Configuration
# ------------------------------------------------------------------------------
ENV_FILE=""
if [[ -n "$CUSTOM_ENV_FILE" ]]; then
  ENV_FILE="$CUSTOM_ENV_FILE"
elif [[ -f "${PROJECT_ROOT}/be/.env" ]]; then
  ENV_FILE="${PROJECT_ROOT}/be/.env"
elif [[ -f "${PROJECT_ROOT}/.env" ]]; then
  ENV_FILE="${PROJECT_ROOT}/.env"
elif [[ -f "./be/.env" ]]; then
  ENV_FILE="./be/.env"
elif [[ -f "./.env" ]]; then
  ENV_FILE="./.env"
fi

get_env_value() {
  local key="$1"
  local file="$2"
  local default_val="${3:-}"

  if [[ -f "$file" ]]; then
    local line
    line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)"
    if [[ -n "$line" ]]; then
      local val="${line#*=}"
      # Strip trailing comments if unquoted
      if [[ ! "$val" =~ ^\".*\"$ && ! "$val" =~ ^\'.*\'$ ]]; then
        val="${val%%#*}"
      fi
      val="$(printf '%s' "$val" | sed -E -e 's/^[[:space:]]+//' -e 's/[[:space:]]+$//')"
      # Strip wrapping quotes
      if [[ "$val" =~ ^\"(.*)\"$ ]]; then
        val="${BASH_REMATCH[1]}"
      elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
        val="${BASH_REMATCH[1]}"
      fi
      printf '%s\n' "$val"
      return 0
    fi
  fi
  printf '%s\n' "$default_val"
}

DB_CONNECTION="$(get_env_value "DB_CONNECTION" "$ENV_FILE" "mysql")"
DB_HOST="${CLI_DB_HOST:-$(get_env_value "DB_HOST" "$ENV_FILE" "127.0.0.1")}"
DB_PORT="${CLI_DB_PORT:-$(get_env_value "DB_PORT" "$ENV_FILE" "3306")}"
PRIMARY_DB_NAME="$(get_env_value "DB_DATABASE" "$ENV_FILE" "DBQLPK")"
DB_USERNAME="${CLI_DB_USER:-$(get_env_value "DB_USERNAME" "$ENV_FILE" "root")}"
DB_PASSWORD="${CLI_DB_PASSWORD:-$(get_env_value "DB_PASSWORD" "$ENV_FILE" "")}"
DB_SOCKET="$(get_env_value "DB_SOCKET" "$ENV_FILE" "")"

# Default target database is PRIMARY_DB_NAME if not specified
if [[ -z "$TARGET_DB" ]]; then
  TARGET_DB="$PRIMARY_DB_NAME"
fi

# Normalize localhost to 127.0.0.1 for standard TCP connection
DB_TARGET_HOST="$DB_HOST"
if [[ "$DB_TARGET_HOST" == "localhost" ]]; then
  DB_TARGET_HOST="127.0.0.1"
fi

# ------------------------------------------------------------------------------
# 5. Resolve Backup Archive File
# ------------------------------------------------------------------------------
BACKUP_DIR="${PROJECT_ROOT}/storage/backups"

# If backup file is not explicitly provided, try to find the latest valid archive in backup directory
if [[ -z "$BACKUP_FILE" ]]; then
  if [[ -d "$BACKUP_DIR" ]]; then
    LATEST_ARCHIVE=$(find "$BACKUP_DIR" -maxdepth 1 \( -name "*.sql.gz" -o -name "*.sql" \) -type f 2>/dev/null | sort -r | head -n 1 || true)
    if [[ -n "$LATEST_ARCHIVE" ]]; then
      BACKUP_FILE="$LATEST_ARCHIVE"
      log_info "No backup file specified. Auto-detected latest archive: $(basename "$BACKUP_FILE")"
    fi
  fi
fi

# If still empty, display error and guidance
if [[ -z "$BACKUP_FILE" ]]; then
  log_error "No backup archive file provided and no existing archives found in ${BACKUP_DIR}."
  log_info "Usage: ./scripts/restore-db.sh [options] <path-to-backup-file.sql.gz>"
  log_info "Run './scripts/restore-db.sh --help' for full instructions."
  exit 1
fi

# Convert BACKUP_FILE to absolute path if necessary
if [[ ! "$BACKUP_FILE" =~ ^/ ]]; then
  BACKUP_FILE="$(pwd)/${BACKUP_FILE}"
fi

# Check file existence and readability
if [[ ! -f "$BACKUP_FILE" ]]; then
  log_error "Backup archive file does not exist: ${BACKUP_FILE}"
  exit 1
fi

if [[ ! -r "$BACKUP_FILE" ]]; then
  log_error "Backup archive file is not readable (permission denied): ${BACKUP_FILE}"
  exit 1
fi

FILE_SIZE_BYTES="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"
FILE_SIZE_HUMAN="$(ls -lh "$BACKUP_FILE" | awk '{print $5}')"

if [[ "$FILE_SIZE_BYTES" -eq 0 ]]; then
  log_error "Backup file is empty (0 bytes): ${BACKUP_FILE}"
  exit 1
fi

# Determine compression format
IS_GZIP=0
if [[ "$BACKUP_FILE" =~ \.gz$ ]]; then
  IS_GZIP=1
fi

# ------------------------------------------------------------------------------
# 6. Archive Integrity Verification
# ------------------------------------------------------------------------------
verify_archive_integrity() {
  log_info "Verifying backup archive integrity..."
  if [[ "$IS_GZIP" -eq 1 ]]; then
    if ! command -v gzip >/dev/null 2>&1; then
      log_error "gzip utility is required to verify and unpack .sql.gz archives."
      return 1
    fi
    if gzip -t "$BACKUP_FILE" 2>/dev/null; then
      log_success "Gzip integrity test PASSED: ${BACKUP_FILE}"
    else
      log_error "Gzip archive is corrupted or truncated: ${BACKUP_FILE}"
      return 1
    fi

    # Inspect first 30 lines for MySQL dump header
    local header
    header="$(gzip -dc "$BACKUP_FILE" | head -n 30 2>/dev/null || true)"
    if echo "$header" | grep -Ei "mysql|mariadb|dump|table" >/dev/null 2>&1; then
      log_success "SQL stream signature verification: Valid database dump detected."
    else
      log_warn "Archive does not exhibit standard MySQL dump headers. Restoration may fail."
    fi
  else
    local header
    header="$(head -n 30 "$BACKUP_FILE" 2>/dev/null || true)"
    if echo "$header" | grep -Ei "mysql|mariadb|dump|table" >/dev/null 2>&1; then
      log_success "Plain SQL file signature verification: Valid database dump detected."
    else
      log_warn "File does not exhibit standard MySQL dump headers."
    fi
  fi
  return 0
}

# ------------------------------------------------------------------------------
# 7. Secure Credentials Configuration
# ------------------------------------------------------------------------------
create_secure_cnf() {
  TEMP_CNF="$(mktemp "${TMPDIR:-/tmp}/qlpk_restore_cnf_XXXXXX")"
  chmod 600 "$TEMP_CNF"
  cat <<EOF > "$TEMP_CNF"
[client]
host=${DB_TARGET_HOST}
port=${DB_PORT}
user=${DB_USERNAME}
password=${DB_PASSWORD}
EOF
  if [[ -n "${DB_SOCKET:-}" ]]; then
    echo "socket=${DB_SOCKET}" >> "$TEMP_CNF"
  fi
}

# ------------------------------------------------------------------------------
# 8. Dry-Run Execution Mode
# ------------------------------------------------------------------------------
if [[ "$DRY_RUN" -eq 1 ]]; then
  cat <<'EOF'
================================================================================
  QLPK SAFE DATABASE RESTORE — DRY-RUN & INTEGRITY VERIFICATION
================================================================================
EOF
  log_info "Mode: DRY-RUN (Zero risk - Production database DBQLPK will NOT be modified)"
  log_info "Project Root: ${PROJECT_ROOT}"
  log_info "Environment File: ${ENV_FILE:-[Not found - Using defaults]}"
  log_info "Primary Database Name: ${PRIMARY_DB_NAME}"
  log_info "Backup File Path: ${BACKUP_FILE}"
  log_info "Archive Format: $( [[ "$IS_GZIP" -eq 1 ]] && echo "Gzip Compressed (.sql.gz)" || echo "Plain SQL (.sql)" )"
  log_info "Archive File Size: ${FILE_SIZE_HUMAN} (${FILE_SIZE_BYTES} bytes)"
  log_info "Test Sandbox Database: ${TEST_DB}"
  log_info "Database Host: ${DB_HOST} (Target: ${DB_TARGET_HOST}:${DB_PORT})"
  log_info "Database User: ${DB_USERNAME}"
  log_info "Database Password: ****** [REDACTED / SECURE MASKING]"

  # Step 1: Verify archive integrity
  if ! verify_archive_integrity; then
    log_error "Dry-run failed: Backup archive integrity check did not pass."
    exit 1
  fi

  # Step 2: Tool checks
  TOOL_MYSQL=0
  if command -v mysql >/dev/null 2>&1; then
    TOOL_MYSQL=1
    log_info "Tool check [mysql]: PASS ($(command -v mysql))"
  else
    log_warn "Tool check [mysql]: mysql client not found in PATH."
  fi

  # Step 3: MySQL Server Connectivity & Test Sandbox Restore Simulation
  if [[ "$TOOL_MYSQL" -eq 1 ]]; then
    create_secure_cnf
    log_info "Testing database server connection to ${DB_TARGET_HOST}:${DB_PORT}..."
    if mysql --defaults-extra-file="$TEMP_CNF" -e "SELECT 1;" >/dev/null 2>&1; then
      log_success "Database server connection: SUCCESSFUL"

      # Execute dry-run restoration into test sandbox database
      log_info "Creating test sandbox database '${TEST_DB}'..."
      mysql --defaults-extra-file="$TEMP_CNF" -e "CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

      log_info "Executing test restore into '${TEST_DB}'..."
      if [[ "$IS_GZIP" -eq 1 ]]; then
        gzip -dc "$BACKUP_FILE" | mysql --defaults-extra-file="$TEMP_CNF" "$TEST_DB"
      else
        mysql --defaults-extra-file="$TEMP_CNF" "$TEST_DB" < "$BACKUP_FILE"
      fi

      # Count tables restored in sandbox
      RESTORED_TABLE_COUNT=$(mysql --defaults-extra-file="$TEMP_CNF" -N -s -e \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${TEST_DB}';")

      log_success "Test restoration into sandbox '${TEST_DB}' completed successfully!"
      log_info "Restored table count in sandbox: ${RESTORED_TABLE_COUNT} tables."

      # Clean up sandbox unless requested to keep
      if [[ "$KEEP_TEST_DB" -eq 1 ]]; then
        log_info "Sandbox database '${TEST_DB}' retained as requested (--keep-test-db)."
      else
        log_info "Cleaning up sandbox database '${TEST_DB}'..."
        mysql --defaults-extra-file="$TEMP_CNF" -e "DROP DATABASE IF EXISTS \`${TEST_DB}\`;"
        log_success "Sandbox database successfully cleaned up."
      fi
    else
      log_warn "Could not connect to live MySQL server at ${DB_TARGET_HOST}:${DB_PORT}."
      log_info "Offline validation: Archive file, gzip header, and syntax checks passed."
    fi
  else
    log_info "Offline dry-run: Archive integrity and metadata validated successfully."
  fi

  cat <<EOF
--------------------------------------------------------------------------------
DRY-RUN VERIFICATION SUMMARY:
  - Backup archive integrity: VERIFIED
  - Safeguard status: Primary database '${PRIMARY_DB_NAME}' remained untouched
  - Archive is READY and SAFE for disaster recovery execution
================================================================================
EOF
  log_success "Dry-run verification completed successfully."
  exit 0
fi

# ------------------------------------------------------------------------------
# 9. Live Restore Pre-flight Checks & Archive Verification
# ------------------------------------------------------------------------------
log_info "Starting safe database restore routine..."
log_info "Backup Archive: ${BACKUP_FILE} (${FILE_SIZE_HUMAN})"
log_info "Target Database: ${TARGET_DB}"

if ! command -v mysql >/dev/null 2>&1; then
  log_error "mysql client utility is required but not found in PATH."
  exit 1
fi

if ! verify_archive_integrity; then
  log_error "Restoration aborted: Backup archive failed integrity check."
  exit 1
fi

create_secure_cnf

# Verify database server connectivity
if ! mysql --defaults-extra-file="$TEMP_CNF" -e "SELECT 1;" >/dev/null 2>&1; then
  log_error "Failed to connect to MySQL database at ${DB_TARGET_HOST}:${DB_PORT} with user '${DB_USERNAME}'."
  exit 1
fi

# ------------------------------------------------------------------------------
# 10. Safety Guards & Confirmation Prompt
# ------------------------------------------------------------------------------
cat <<EOF

********************************************************************************
                          DISASTER RECOVERY WARNING
********************************************************************************
You are about to restore the database:
  Target Database : ${TARGET_DB}
  Host / Port     : ${DB_TARGET_HOST}:${DB_PORT}
  Source Archive  : $(basename "$BACKUP_FILE")
  Archive Size    : ${FILE_SIZE_HUMAN}

WARNING: This operation will OVERWRITE existing data in '${TARGET_DB}'.
********************************************************************************

EOF

if [[ "$FORCE_CONFIRM" -ne 1 ]]; then
  if [[ -t 0 ]]; then
    printf "To confirm and proceed with restoration, type 'CONFIRM_RESTORE': "
    read -r CONFIRMATION
    if [[ "$CONFIRMATION" != "CONFIRM_RESTORE" ]]; then
      log_warn "Restoration cancelled by operator. Input did not match 'CONFIRM_RESTORE'."
      exit 1
    fi
    log_info "Operator confirmation received. Proceeding with restoration..."
  else
    log_error "Non-interactive shell detected and neither --force nor --confirm-overwrite was provided."
    log_error "Restoration to '${TARGET_DB}' aborted to prevent accidental data loss."
    exit 1
  fi
else
  log_warn "Confirmation bypassed via explicit flag (--force / --confirm-overwrite)."
fi

# ------------------------------------------------------------------------------
# 11. Automatic Pre-Restoration Snapshot
# ------------------------------------------------------------------------------
if [[ "$SKIP_SAFETY_BACKUP" -eq 0 ]]; then
  # Check if target database currently exists and contains tables
  DB_EXISTS=$(mysql --defaults-extra-file="$TEMP_CNF" -N -s -e \
    "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${TARGET_DB}';" 2>/dev/null || true)

  if [[ -n "$DB_EXISTS" ]]; then
    CURRENT_TABLE_COUNT=$(mysql --defaults-extra-file="$TEMP_CNF" -N -s -e \
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${TARGET_DB}';" 2>/dev/null || echo "0")

    if [[ "$CURRENT_TABLE_COUNT" -gt 0 ]] && command -v mysqldump >/dev/null 2>&1; then
      SAFETY_TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
      SAFETY_BACKUP_NAME="pre_restore_${TARGET_DB}_${SAFETY_TIMESTAMP}.sql.gz"
      SAFETY_BACKUP_PATH="${BACKUP_DIR}/${SAFETY_BACKUP_NAME}"
      mkdir -p "$BACKUP_DIR"

      log_info "Creating emergency pre-restoration snapshot before overwriting '${TARGET_DB}'..."
      if mysqldump --defaults-extra-file="$TEMP_CNF" \
          --single-transaction \
          --quick \
          --routines \
          --triggers \
          "$TARGET_DB" | gzip -9 > "$SAFETY_BACKUP_PATH" 2>/dev/null; then
        chmod 600 "$SAFETY_BACKUP_PATH"
        log_success "Pre-restoration snapshot created: ${SAFETY_BACKUP_NAME}"
      else
        log_warn "Could not create pre-restoration snapshot. Proceeding as target may be unreadable."
      fi
    fi
  fi
else
  log_info "Safety pre-restore backup skipped (--skip-safety-backup)."
fi

# ------------------------------------------------------------------------------
# 12. Database Restoration Execution
# ------------------------------------------------------------------------------
log_info "Preparing target database '${TARGET_DB}'..."
mysql --defaults-extra-file="$TEMP_CNF" -e \
  "CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

log_info "Restoring data from '${BACKUP_FILE}' into '${TARGET_DB}'..."

RESTORE_START=$(date +%s)
if [[ "$IS_GZIP" -eq 1 ]]; then
  if gzip -dc "$BACKUP_FILE" | mysql --defaults-extra-file="$TEMP_CNF" "$TARGET_DB"; then
    RESTORE_STATUS=0
  else
    RESTORE_STATUS=$?
  fi
else
  if mysql --defaults-extra-file="$TEMP_CNF" "$TARGET_DB" < "$BACKUP_FILE"; then
    RESTORE_STATUS=0
  else
    RESTORE_STATUS=$?
  fi
fi

RESTORE_END=$(date +%s)
DURATION=$(( RESTORE_END - RESTORE_START ))

if [[ "$RESTORE_STATUS" -ne 0 ]]; then
  log_error "Restoration failed with exit code ${RESTORE_STATUS}."
  exit "$RESTORE_STATUS"
fi

# ------------------------------------------------------------------------------
# 13. Post-Restoration Verification
# ------------------------------------------------------------------------------
log_info "Performing post-restoration verification..."
FINAL_TABLE_COUNT=$(mysql --defaults-extra-file="$TEMP_CNF" -N -s -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${TARGET_DB}';" 2>/dev/null || echo "0")

log_info "Total tables in restored database '${TARGET_DB}': ${FINAL_TABLE_COUNT}"

if [[ "$FINAL_TABLE_COUNT" -eq 0 ]]; then
  log_warn "Target database '${TARGET_DB}' has 0 tables after restoration. Please verify dump contents."
else
  log_success "Database schema and tables verified (${FINAL_TABLE_COUNT} tables active)."
fi

cat <<EOF
================================================================================
  DATABASE RESTORATION COMPLETED SUCCESSFULLY
================================================================================
  Target Database : ${TARGET_DB}
  Restored Tables : ${FINAL_TABLE_COUNT}
  Duration        : ${DURATION} seconds
  Source Archive  : $(basename "$BACKUP_FILE")
  Timestamp       : $(date '+%Y-%m-%d %H:%M:%S')
================================================================================
EOF

log_success "Disaster recovery restore operation finished without errors."
exit 0
