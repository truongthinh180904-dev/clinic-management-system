# Automated Test Report — P2-026

- `RUN_ID`: `run-20261028002755-32432-27730`
- `TIMESTAMP`: `2026-10-28T00:44:32+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=ApprovalWorkflowApiTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=ApprovalWorkflowApiTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":11,"passed":11,"assertions":80,"duration_ms":1559}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint && ./vendor/bin/pint --test` (exit_code=0)
```text

  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ...........

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 223 files  


  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ...........

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 223 files  
```

