# Automated Test Report — P2-020

- `RUN_ID`: `run-20261028080815-72377-30337`
- `TIMESTAMP`: `2026-10-28T08:14:59+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=ManagementReportApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=ManagementReportApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":12,"passed":12,"assertions":71,"duration_ms":3089}
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

