# Automated Test Report — P2-018

- `RUN_ID`: `run-20261027201524-32432-24318`
- `TIMESTAMP`: `2026-10-27T20:40:28+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=KpiTargetApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=KpiTargetApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":13,"passed":13,"assertions":112,"duration_ms":2914}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` (exit_code=0)
```text

  .....................................................
  .....................................................
  .....................................................
  .................................................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 208 files  


  .....................................................
  .....................................................
  .....................................................
  .................................................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 208 files  
```

