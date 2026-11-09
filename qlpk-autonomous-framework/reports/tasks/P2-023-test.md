# Automated Test Report — P2-023

- `RUN_ID`: `run-20261028083005-72377-13750`
- `TIMESTAMP`: `2026-10-28T08:37:38+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=DataExportApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=DataExportApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":8,"passed":8,"assertions":80,"duration_ms":2171}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` (exit_code=0)
```text

  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ...................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 231 files  


  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ...................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 231 files  
```

