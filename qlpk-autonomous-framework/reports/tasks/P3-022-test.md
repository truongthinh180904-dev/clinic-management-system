# Automated Test Report — P3-022

- `RUN_ID`: `run-20261028200522-17067-5242`
- `TIMESTAMP`: `2026-10-28T20:17:59+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=RolePermissionTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=RolePermissionTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":14,"passed":14,"assertions":90,"duration_ms":1968}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text

  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ..............................

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 242 files  
```

