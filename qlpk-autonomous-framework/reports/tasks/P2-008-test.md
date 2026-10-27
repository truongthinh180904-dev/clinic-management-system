# Automated Test Report — P2-008

- `RUN_ID`: `run-20261027190506-32432-32149`
- `TIMESTAMP`: `2026-10-27T19:10:15+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=PaymentApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=PaymentApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":13,"passed":13,"assertions":98,"duration_ms":2783}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` (exit_code=0)
```text

  .....................................................
  .....................................................
  .....................................................
  .............................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 188 files  


  .....................................................
  .....................................................
  .....................................................
  .............................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 188 files  
```

