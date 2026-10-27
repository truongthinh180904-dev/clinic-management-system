# Automated Test Report — P1-014

- `RUN_ID`: `run-20261027084109-30702-1303`
- `TIMESTAMP`: `2026-10-27T08:47:58+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":16,"passed":16,"assertions":104,"duration_ms":1573}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

