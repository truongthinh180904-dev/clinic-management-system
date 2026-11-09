# Automated Test Report — P3-028

- `RUN_ID`: `run-20261029105150-20344-15196`
- `TIMESTAMP`: `2026-10-29T11:22:14+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":599,"passed":599,"assertions":5468,"duration_ms":86570}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text

  ........................................................................................
  ........................................................................................
  ...........................................................................

  ──────────────────────────────────────────────────────────────────────────────── Laravel  
    PASS   ..................................................................... 251 files  
```

