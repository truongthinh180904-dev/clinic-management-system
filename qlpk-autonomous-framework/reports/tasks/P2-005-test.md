# Automated Test Report — P2-005

- `RUN_ID`: `run-20261027185857-32432-11529`
- `TIMESTAMP`: `2026-10-27T19:03:58+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=DashboardApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=DashboardApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":7,"passed":7,"assertions":98,"duration_ms":1905}
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

