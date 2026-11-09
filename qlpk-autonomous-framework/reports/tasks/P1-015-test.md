# Automated Test Report — P1-015

- `RUN_ID`: `run-20261027084914-30702-10338`
- `TIMESTAMP`: `2026-10-27T08:55:28+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` (exit_code=0)
```text

> fe@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
✓ Running next.config.ts took 33ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 1820ms
  Running TypeScript ...
  Finished TypeScript in 4.1s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/16) ...
  Generating static pages using 3 workers (4/16) 
  Generating static pages using 3 workers (8/16) 
  Generating static pages using 3 workers (12/16) 
✓ Generating static pages using 3 workers (16/16) in 700ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/employees
├ ○ /admin/patients
├ ○ /admin/rbac
├ ○ /admin/reception
├ ○ /admin/users
├ ○ /employees
├   /employees/[id]
│ └ ◐ /employees/[id]
├ ○ /login
├ ○ /patients
├   /patients/[id]
│ └ ◐ /patients/[id]
└ ○ /users


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

