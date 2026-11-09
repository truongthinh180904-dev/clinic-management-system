# Automated Test Report — P3-027

- `RUN_ID`: `run-20261029104243-20344-10509`
- `TIMESTAMP`: `2026-10-29T10:49:33+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan migrate --pretend` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && php artisan test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan migrate --pretend` (exit_code=0)
```text

 INFO Running migrations. 

 2026_10_29_110000_add_phase_3_composite_indexes .. 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'visits' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'visits' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'appointments' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'invoices' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'invoices' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'cash_transactions' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'cash_transactions' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'inventory_transactions' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'inventory_transactions' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
 ⇂ select exists (select 1 from information_schema.tables where table_schema = schema() and table_name = 'audit_logs' and table_type in ('BASE TABLE', 'SYSTEM VERSIONED')) as `exists` 
```

### Command: `cd "$PROJECT_ROOT/be" && php artisan test` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":594,"passed":594,"assertions":5433,"duration_ms":75996}
```

