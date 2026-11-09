# Automated Test Report — P1-012

- `RUN_ID`: `run-20261027080710-30702-2965`
- `TIMESTAMP`: `2026-10-27T08:19:43+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=UserManagementApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=UserManagementApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":19,"passed":19,"assertions":153,"duration_ms":2111}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

