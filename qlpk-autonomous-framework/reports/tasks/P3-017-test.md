# Automated Test Report — P3-017

- `RUN_ID`: `run-20261028184951-17067-17649`
- `TIMESTAMP`: `2026-10-28T19:07:34+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":549,"passed":549,"assertions":5065,"duration_ms":58040}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text

  .....................................................
  .....................................................
  .....................................................
  .....................................................
  .............................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 241 files  
```

