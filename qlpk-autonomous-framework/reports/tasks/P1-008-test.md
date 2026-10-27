# Automated Test Report — P1-008

- `RUN_ID`: `run-20261027072223-22504-32587`
- `TIMESTAMP`: `2026-10-27T07:30:01+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=AuthApiTest` | `1` | `FAIL` |

## Summary
- `OVERALL_TEST_RESULT`: `FAIL`
- `EXIT_CODE`: `1`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=AuthApiTest` (exit_code=1)
```text
{"tool":"phpunit","result":"failed","tests":14,"passed":13,"assertions":51,"duration_ms":1056,"failed":1,"failures":[{"test":"Tests\\Feature\\AuthApiTest::test_logout_revokes_token_and_writes_audit_log","file":"/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/be/tests/Feature/AuthApiTest.php","line":352,"message":"Expected response status code [401] but received 200.\nFailed asserting that 200 is identical to 401.","trace":["/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/be/vendor/laravel/framework/src/Illuminate/Testing/TestResponseAssert.php:46","/Users/truongthinh/Documents/UIT/Manage Infomation/clinic-management-system/be/tests/Feature/AuthApiTest.php:352"]}]}
```

