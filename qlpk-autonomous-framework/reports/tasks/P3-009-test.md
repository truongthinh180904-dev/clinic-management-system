# Automated Test Report — P3-009

- `RUN_ID`: `run-20261028165213-17067-6313`
- `TIMESTAMP`: `2026-10-28T16:55:44+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `test -s "$PROJECT_ROOT/docs/phase-3/UI_STANDARDIZATION_REPORT.md"` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `test -s "$PROJECT_ROOT/docs/phase-3/UI_STANDARDIZATION_REPORT.md"` (exit_code=0)
```text

```

### Command: `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` (exit_code=0)
```text

> fe@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 34ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 970ms
  Running TypeScript ...
  Finished TypeScript in 3.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/39) ...
  Generating static pages using 3 workers (9/39) 
  Generating static pages using 3 workers (19/39) 
  Generating static pages using 3 workers (29/39) 
✓ Generating static pages using 3 workers (39/39) in 1474ms
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
├ ○ /approvals
├ ○ /cash-book
├ ○ /data-transfer
├ ○ /debts
├ ○ /employees
├   /employees/[id]
│ └ ◐ /employees/[id]
├ ○ /finance/cashbook
├ ○ /inventory
├ ○ /invoices
├   /invoices/[id]
│ └ ◐ /invoices/[id]
├ ○ /kpi
├ ○ /login
├ ○ /notifications
├ ○ /packages
├ ○ /patients
├   /patients/[id]
│ └ ◐ /patients/[id]
├ ○ /reports
├ ○ /services
├ ○ /users
├ ○ /visits
├   /visits/[id]
│ └ ◐ /visits/[id]
└ ○ /visits/new


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

