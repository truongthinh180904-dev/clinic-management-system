# Automated Test Report — P1-009

- `RUN_ID`: `run-20261027073741-30702-5311`
- `TIMESTAMP`: `2026-10-27T07:49:08+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=RbacAuthorizationTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=RbacAuthorizationTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":21,"passed":21,"assertions":981,"duration_ms":2626}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

