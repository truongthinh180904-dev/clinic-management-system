# Automated Test Report — P1-020

- `RUN_ID`: `run-20261027094017-30702-30182`
- `TIMESTAMP`: `2026-10-27T09:50:34+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=AppointmentApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=AppointmentApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":21,"passed":21,"assertions":118,"duration_ms":1949}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

