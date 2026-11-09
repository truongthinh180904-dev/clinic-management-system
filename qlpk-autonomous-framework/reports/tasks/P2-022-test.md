# Automated Test Report — P2-022

- `RUN_ID`: `run-20261028082512-72377-30596`
- `TIMESTAMP`: `2026-10-28T08:28:12+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=DataImportApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=DataImportApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":10,"passed":10,"assertions":79,"duration_ms":1739}
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

