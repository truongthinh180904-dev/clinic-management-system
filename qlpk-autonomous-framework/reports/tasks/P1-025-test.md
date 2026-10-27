# Automated Test Report — P1-025

- `RUN_ID`: `run-20261027103453-30702-3290`
- `TIMESTAMP`: `2026-10-27T10:42:56+0700`

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
✓ Running next.config.ts took 35ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 2.7s
  Running TypeScript ...
  Finished TypeScript in 5.3s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/24) ...
  Generating static pages using 3 workers (6/24) 
  Generating static pages using 3 workers (12/24) 
  Generating static pages using 3 workers (18/24) 
✓ Generating static pages using 3 workers (24/24) in 864ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/appointments
├ ○ /admin/employees
├ ○ /admin/patients
├ ○ /admin/rbac
├ ○ /admin/reception
├ ○ /admin/users
├ ○ /appointments
├   /appointments/[id]
│ └ ◐ /appointments/[id]
├ ○ /employees
├   /employees/[id]
│ └ ◐ /employees/[id]
├ ○ /login
├ ○ /packages
├ ○ /patients
├   /patients/[id]
│ └ ◐ /patients/[id]
├ ○ /services
├ ○ /users
├ ○ /visits
├   /visits/[id]
│ └ ◐ /visits/[id]
└ ○ /visits/new


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

