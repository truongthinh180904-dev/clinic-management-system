# Automated Test Report — P1-019

- `RUN_ID`: `run-20261027092309-30702-8731`
- `TIMESTAMP`: `2026-10-27T09:38:34+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientPackageApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientPackageApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":17,"passed":17,"assertions":63,"duration_ms":1701}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

