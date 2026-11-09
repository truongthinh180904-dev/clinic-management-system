# Automated Test Report — P2-011

- `RUN_ID`: `run-20261027191715-32432-6846`
- `TIMESTAMP`: `2026-10-27T19:20:07+0700`

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
- Environments: .env.local
✓ Running next.config.ts took 71ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 4.4s
  Running TypeScript ...
  Finished TypeScript in 10.9s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/31) ...
  Generating static pages using 3 workers (7/31) 
  Generating static pages using 3 workers (15/31) 
  Generating static pages using 3 workers (23/31) 
✓ Generating static pages using 3 workers (31/31) in 3.6s
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/appointments
├ ○ /admin/consultations
├ ○ /admin/employees
├ ○ /admin/packages
├ ○ /admin/patients
├ ○ /admin/rbac
├ ○ /admin/reception
├ ○ /admin/services
├ ○ /admin/users
├ ○ /admin/visits
├ ○ /appointments
├   /appointments/[id]
│ └ ◐ /appointments/[id]
├ ○ /debts
├ ○ /employees
├   /employees/[id]
│ └ ◐ /employees/[id]
├ ○ /invoices
├   /invoices/[id]
│ └ ◐ /invoices/[id]
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

