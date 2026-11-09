# Automated Test Report — P2-025

- `RUN_ID`: `run-20261028001357-32432-5097`
- `TIMESTAMP`: `2026-10-28T00:26:46+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=NotificationAndAlertApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=NotificationAndAlertApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":18,"passed":18,"assertions":67,"duration_ms":1971}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` (exit_code=0)
```text

  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ........

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 220 files  


  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ........

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 220 files  
```

