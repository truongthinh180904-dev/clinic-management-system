# Automated Test Report — P2-010

- `RUN_ID`: `run-20261027191123-32432-9814`
- `TIMESTAMP`: `2026-10-27T19:16:10+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=DebtManagementApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=DebtManagementApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":12,"passed":12,"assertions":92,"duration_ms":2158}
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

