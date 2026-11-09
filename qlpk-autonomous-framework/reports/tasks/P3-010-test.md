# Automated Test Report — P3-010

- `RUN_ID`: `run-20261028165657-17067-19162`
- `TIMESTAMP`: `2026-10-28T17:13:44+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":9,"passed":9,"assertions":59,"duration_ms":1724}
```

### Command: `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` (exit_code=0)
```text

> fe@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 45ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 5.5s
  Running TypeScript ...
  Finished TypeScript in 7.4s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/39) ...
  Generating static pages using 3 workers (9/39) 
  Generating static pages using 3 workers (19/39) 
  Generating static pages using 3 workers (29/39) 
✓ Generating static pages using 3 workers (39/39) in 1320ms
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

