# Automated Test Report — P1-024

- `RUN_ID`: `run-20261027102542-30702-352`
- `TIMESTAMP`: `2026-10-27T10:33:24+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=MedicalRecordApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=MedicalRecordApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":15,"passed":15,"assertions":76,"duration_ms":1815}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"pint","result":"passed"}
```

