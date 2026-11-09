# Automated Test Report — P2-012

- `RUN_ID`: `run-20261028075321-72377-12077`
- `TIMESTAMP`: `2026-10-28T08:05:50+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=ExpenseApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=ExpenseApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":17,"passed":17,"assertions":149,"duration_ms":2780}
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

