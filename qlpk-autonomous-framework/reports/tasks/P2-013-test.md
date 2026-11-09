# Automated Test Report — P2-013

- `RUN_ID`: `run-20261027192916-32432-6900`
- `TIMESTAMP`: `2026-10-27T19:35:57+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=CashTransactionApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=CashTransactionApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":12,"passed":12,"assertions":110,"duration_ms":1974}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` (exit_code=0)
```text

  .....................................................
  .....................................................
  .....................................................
  .................................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 192 files  


  .....................................................
  .....................................................
  .....................................................
  .................................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 192 files  
```

