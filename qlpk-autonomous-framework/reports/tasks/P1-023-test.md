# Automated Test Report — P1-023

- `RUN_ID`: `run-20261027101625-30702-12761`
- `TIMESTAMP`: `2026-10-27T10:24:17+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=VisitPackageUsageTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=VisitPackageUsageTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":21,"passed":21,"assertions":112,"duration_ms":2383}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

