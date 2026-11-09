# Automated Test Report — P1-011

- `RUN_ID`: `run-20261027075653-30702-26735`
- `TIMESTAMP`: `2026-10-27T08:05:44+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=EmployeeApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=EmployeeApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":21,"passed":21,"assertions":117,"duration_ms":1991}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

