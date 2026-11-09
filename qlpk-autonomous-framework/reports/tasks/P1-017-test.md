# Automated Test Report — P1-017

- `RUN_ID`: `run-20261027090452-30702-30055`
- `TIMESTAMP`: `2026-10-27T09:10:40+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=ServicePackageApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=ServicePackageApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":24,"passed":24,"assertions":84,"duration_ms":2153}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

