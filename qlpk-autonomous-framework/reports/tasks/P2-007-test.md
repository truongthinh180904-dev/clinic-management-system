# Automated Test Report — P2-007

- `RUN_ID`: `run-20261027161441-96111-5283`
- `TIMESTAMP`: `2026-10-27T16:27:17+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=InvoiceApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=InvoiceApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":17,"passed":17,"assertions":92,"duration_ms":2102}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

