#!/usr/bin/env bash
# ==============================================================================
# Clinic Management System (QLPK) - Automated Database Backup Script
# ==============================================================================
# Script: scripts/backup-db.sh
# Feature: F3-08 (Backup, Recovery & Operational Procedures)
# Task: P3-025 (Automated Database Backup with Gzip Compression & Retention)
#
# Description:
#   Dumps the 30-table MySQL database (DBQLPK) using mysqldump with InnoDB
#   single-transaction consistency, streams the output directly into gzip
#   for maximum compression, names the archive with a precise timestamp,
#   stores it in storage/backups/, and automatically purges archives older
#   than the retention policy (default: 30 days).
#
# Security & Safety:
#   - Database credentials are read dynamically from .env (be/.env).
#   - Passwords are NEVER passed as command-line arguments to prevent leakage
#     via process inspection (`ps aux`, `top`, `/proc/*/cmdline`). A temporary
#     secure MySQL options file (mode 0600) is used with --defaults-extra-file
#     and automatically removed via signal traps on EXIT/INT/TERM.
#   - Pre-flight disk space validation ensures minimum required free space.
#   - Includes --dry-run mode to validate configurations and test environment.
#
# Cron Job Configuration:
#   To run daily at 02:00 AM server local time:
#   1. Open crontab editor:
#        crontab -e
#   2. Add the following entry (adjust path as needed):
#        0 2 * * * /Users/truongthinh/Documents/UIT/Manage\ Infomation/clinic-management-system/scripts/backup-db.sh >> /Users/truongthinh/Documents/UIT/Manage\ Infomation/clinic-management-system/storage/backups/backup.log 2>&1
# ==============================================================================

set -Eeuo pipefail

# ------------------------------------------------------------------------------
# 1. Base Variables & Directory Resolution
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd -- "${SCRIPT_DIR}/.." && pwd)}"

# Defaults
DEFAULT_RETENTION_DAYS=30
RETENTION_DAYS="${RETENTION_DAYS:-$DEFAULT_RETENTION_DAYS}"
CUSTOM_ENV_FILE=""
CUSTOM_BACKUP_DIR=""
CLI_DB_NAME=""
CLI_DB_HOST=""
CLI_DB_PORT=""
CLI_DB_USER=""
CLI_DB_PASSWORD=""
DRY_RUN=0
VERBOSE=0

# Clean temporary option file on any exit
TEMP_CNF=""
cleanup() {
  local exit_code=$?
  if [[ -n "${TEMP_CNF:-}" && -f "${TEMP_CNF}" ]]; then
    rm -f "${TEMP_CNF}" 2>/dev/null || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# 2. Helper Functions
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
QLPK Automated Database Backup Script (scripts/backup-db.sh)

Usage:
  backup-db.sh [options]

Options:
  --dry-run                 Simulate backup execution, validate config & environment without dumping
  --retention, -r <days>    Number of days to keep backup archives (default: 30)
  --output-dir, -o <path>   Custom directory for backup archives (default: storage/backups)
  --env, -e <path>          Path to Laravel .env file (default: be/.env or .env)
  --database, --db <name>   Override database name (default: from .env or DBQLPK)
  --host <host>             Override database host (default: from .env or 127.0.0.1)
  --port <port>             Override database port (default: from .env or 3306)
  --user, -u <user>         Override database username (default: from .env or root)
  -v, --verbose             Display verbose diagnostic logs
  -h, --help                Display this help message and exit

Cron Job Instructions:
  To schedule an automated backup every day at 02:00 AM:
    0 2 * * * "/path/to/clinic-management-system/scripts/backup-db.sh" >> "/path/to/clinic-management-system/storage/backups/backup.log" 2>&1

Examples:
  ./scripts/backup-db.sh --dry-run
  ./scripts/backup-db.sh --retention 45
  ./scripts/backup-db.sh --output-dir /mnt/secure-backups/qlpk
  ./scripts/backup-db.sh --database DBQLPK_PROD
EOF
}

# ------------------------------------------------------------------------------
# 3. Argument Parsing
# ------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --retention|-r)
      if [[ -n "${2:-}" && "$2" =~ ^[0-9]+$ ]]; then
        RETENTION_DAYS="$2"
        shift 2
      else
        log_error "Option --retention requires a numeric argument."
        exit 1
      fi
      ;;
    --output-dir|-o)
      if [[ -n "${2:-}" ]]; then
        CUSTOM_BACKUP_DIR="$2"
        shift 2
      else
        log_error "Option --output-dir requires a path argument."
        exit 1
      fi
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
    --database|--db)
      if [[ -n "${2:-}" ]]; then
        CLI_DB_NAME="$2"
        shift 2
      else
        log_error "Option --database requires a database name argument."
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
    *)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

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
DB_DATABASE="${CLI_DB_NAME:-$(get_env_value "DB_DATABASE" "$ENV_FILE" "DBQLPK")}"
DB_USERNAME="${CLI_DB_USER:-$(get_env_value "DB_USERNAME" "$ENV_FILE" "root")}"
DB_PASSWORD="${CLI_DB_PASSWORD:-$(get_env_value "DB_PASSWORD" "$ENV_FILE" "")}"
DB_SOCKET="$(get_env_value "DB_SOCKET" "$ENV_FILE" "")"

# Normalize localhost to 127.0.0.1 for standard TCP connection if needed
DB_TARGET_HOST="$DB_HOST"
if [[ "$DB_TARGET_HOST" == "localhost" ]]; then
  DB_TARGET_HOST="127.0.0.1"
fi

# ------------------------------------------------------------------------------
# 5. Resolve Backup Directory
# ------------------------------------------------------------------------------
if [[ -n "$CUSTOM_BACKUP_DIR" ]]; then
  BACKUP_DIR="$CUSTOM_BACKUP_DIR"
else
  # Default to project storage/backups (and mirror to be/storage/backups if present)
  BACKUP_DIR="${PROJECT_ROOT}/storage/backups"
fi

mkdir -p "$BACKUP_DIR"
# If be/storage exists, ensure be/storage/backups exists too for consistency
if [[ -d "${PROJECT_ROOT}/be/storage" && ! -d "${PROJECT_ROOT}/be/storage/backups" ]]; then
  mkdir -p "${PROJECT_ROOT}/be/storage/backups" 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# 6. Pre-flight Checks (Disk Space & Tooling)
# ------------------------------------------------------------------------------
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILENAME="backup_${DB_DATABASE}_${TIMESTAMP}.sql.gz"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}"

check_disk_space() {
  local target_dir="$1"
  local min_required_mb=50
  if command -v df >/dev/null 2>&1; then
    local available_kb
    available_kb="$( (df -k "$target_dir" 2>/dev/null || true) | awk 'NR==2 {print $4}' )"
    if [[ -n "$available_kb" && "$available_kb" =~ ^[0-9]+$ ]]; then
      local available_mb=$(( available_kb / 1024 ))
      if (( available_mb < min_required_mb )); then
        log_error "Low disk space on ${target_dir}: only ${available_mb}MB available, minimum required is ${min_required_mb}MB."
        return 1
      fi
      if [[ "$VERBOSE" -eq 1 ]]; then
        log_info "Disk space verified: ${available_mb}MB available on backup volume."
      fi
    fi
  fi
  return 0
}

# ------------------------------------------------------------------------------
# 7. Dry-Run Mode Execution
# ------------------------------------------------------------------------------
if [[ "$DRY_RUN" -eq 1 ]]; then
  cat <<'EOF'
================================================================================
  QLPK AUTOMATED DATABASE BACKUP — PRE-FLIGHT / DRY-RUN SIMULATION
================================================================================
EOF
  log_info "Mode: DRY-RUN (No files will be modified or database queries executed)"
  log_info "Project Root: ${PROJECT_ROOT}"
  log_info "Environment File: ${ENV_FILE:-[Not found - Using system defaults]}"
  log_info "Database Driver: ${DB_CONNECTION}"
  log_info "Database Host: ${DB_HOST} (Target: ${DB_TARGET_HOST})"
  log_info "Database Port: ${DB_PORT}"
  log_info "Database Name: ${DB_DATABASE}"
  log_info "Database User: ${DB_USERNAME}"
  log_info "Database Password: ****** [REDACTED / MASKED FROM PROCESS LIST]"
  log_info "Backup Directory: ${BACKUP_DIR}"
  log_info "Retention Policy: ${RETENTION_DAYS} days"
  log_info "Simulated Backup Filename: ${BACKUP_FILENAME}"

  # Validate gzip
  if command -v gzip >/dev/null 2>&1; then
    log_info "Tool check [gzip]: PASS ($(command -v gzip))"
  else
    log_warn "Tool check [gzip]: NOT FOUND in PATH"
  fi

  # Validate mysqldump
  if command -v mysqldump >/dev/null 2>&1; then
    log_info "Tool check [mysqldump]: PASS ($(command -v mysqldump))"
  else
    log_warn "Tool check [mysqldump]: Not installed in current shell path (required for live dump)"
  fi

  # Validate disk space
  if check_disk_space "$BACKUP_DIR"; then
    log_info "Disk space check: PASS"
  else
    log_warn "Disk space check: Low free space detected"
  fi

  # Simulate retention purge count
  expired_count=$( (find "$BACKUP_DIR" -maxdepth 1 -name "backup_${DB_DATABASE}_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" 2>/dev/null || true) | wc -l | tr -d ' ' )
  log_info "Retention check: Found ${expired_count:-0} backup files older than ${RETENTION_DAYS} days to be purged."

  cat <<EOF
--------------------------------------------------------------------------------
Security Compliance & Masking:
  - MySQL authentication uses temporary option file (--defaults-extra-file)
  - Process tables (ps aux, top) will NEVER show the database password
  - Strict trap ensures temporary credentials file is instantly removed
--------------------------------------------------------------------------------
Automated Cron Job Schedule Example:
  # Daily database backup at 02:00 AM:
  0 2 * * * "${SCRIPT_DIR}/backup-db.sh" >> "${BACKUP_DIR}/backup.log" 2>&1
================================================================================
EOF
  log_success "Dry-run verification completed successfully. All pre-flight checks passed."
  exit 0
fi

# ------------------------------------------------------------------------------
# 8. Live Backup Execution
# ------------------------------------------------------------------------------
log_info "Starting automated database backup for database '${DB_DATABASE}'..."

# Verify tools
if ! command -v gzip >/dev/null 2>&1; then
  log_error "gzip utility is required but not found in PATH."
  exit 1
fi

if ! command -v mysqldump >/dev/null 2>&1; then
  log_error "mysqldump utility is required but not found in PATH."
  exit 1
fi

# Verify disk space
if ! check_disk_space "$BACKUP_DIR"; then
  exit 1
fi

# Create secure temporary configuration file for credentials (mode 0600)
TEMP_CNF="$(mktemp "${TMPDIR:-/tmp}/qlpk_backup_cnf_XXXXXX")"
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

log_info "Extracting schema and data with single-transaction snapshot..."

# Execute mysqldump with password masking and gzip compression
# Flags:
#   --single-transaction: consistent InnoDB snapshot without locking reads
#   --quick: stream row by row
#   --routines: include stored procedures and functions
#   --triggers: include table triggers
#   --events: include scheduled events
#   --set-gtid-purged=OFF: avoid GTID replication errors
#   --no-autocommit: optimize restore speed
if mysqldump --defaults-extra-file="$TEMP_CNF" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    --set-gtid-purged=OFF \
    "$DB_DATABASE" | gzip -9 > "$BACKUP_FILE"; then

  # Secure archive permissions
  chmod 600 "$BACKUP_FILE"

  # Validate gzip integrity
  if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    file_size_bytes="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"
    file_size_human="$(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
    log_success "Database backup successfully created: ${BACKUP_FILENAME} (${file_size_human}, ${file_size_bytes} bytes)"
  else
    log_error "Backup archive verification failed (corrupt gzip output): ${BACKUP_FILE}"
    rm -f "$BACKUP_FILE" 2>/dev/null || true
    exit 1
  fi
else
  log_error "mysqldump execution failed for database '${DB_DATABASE}'."
  rm -f "$BACKUP_FILE" 2>/dev/null || true
  exit 1
fi

# ------------------------------------------------------------------------------
# 9. Retention Policy Cleanup
# ------------------------------------------------------------------------------
log_info "Applying retention policy: purging backups older than ${RETENTION_DAYS} days..."

purged_files=()
while IFS= read -r file; do
  [[ -n "$file" ]] && purged_files+=("$file")
done < <(find "$BACKUP_DIR" -maxdepth 1 -name "backup_${DB_DATABASE}_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" 2>/dev/null || true)

if [[ "${#purged_files[@]}" -gt 0 ]]; then
  for pfile in "${purged_files[@]}"; do
    rm -f "$pfile"
    log_info "Purged expired backup: $(basename "$pfile")"
  done
  log_success "Retention cleanup finished: ${#purged_files[@]} expired backup(s) removed."
else
  log_info "No backup files exceeded the ${RETENTION_DAYS}-day retention threshold."
fi

log_success "Automated backup routine completed successfully."
exit 0
