# Automated Test Report — P1-013

- `RUN_ID`: `run-20261027082126-30702-30761`
- `TIMESTAMP`: `2026-10-27T08:39:00+0700`

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
✓ Running next.config.ts took 34ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 1567ms
  Running TypeScript ...
  Finished TypeScript in 2.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/12) ...
  Generating static pages using 3 workers (3/12) 
  Generating static pages using 3 workers (6/12) 
  Generating static pages using 3 workers (9/12) 
✓ Generating static pages using 3 workers (12/12) in 487ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/employees
├ ○ /admin/rbac
├ ○ /admin/users
├ ○ /employees
├   /employees/[id]
│ └ ◐ /employees/[id]
├ ○ /login
└ ○ /users


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

