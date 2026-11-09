# Automated Test Report — P3-026

- `RUN_ID`: `run-20261029103712-20344-20655`
- `TIMESTAMP`: `2026-10-29T10:41:28+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `test -s "$PROJECT_ROOT/scripts/restore-db.sh"` | `0` | `PASS` |
| `test -s "$PROJECT_ROOT/docs/phase-3/DISASTER_RECOVERY_RUNBOOK.md"` | `0` | `PASS` |
| `bash "$PROJECT_ROOT/scripts/restore-db.sh" --help` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `test -s "$PROJECT_ROOT/scripts/restore-db.sh"` (exit_code=0)
```text

```

### Command: `test -s "$PROJECT_ROOT/docs/phase-3/DISASTER_RECOVERY_RUNBOOK.md"` (exit_code=0)
```text

```

### Command: `bash "$PROJECT_ROOT/scripts/restore-db.sh" --help` (exit_code=0)
```text
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
```

