# Automated Test Report — P3-014

- `RUN_ID`: `run-20261028175543-17067-31252`
- `TIMESTAMP`: `2026-10-28T18:10:14+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test --filter=VisitTest` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test --filter=VisitTest` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":6,"passed":6,"assertions":43,"duration_ms":1012}
```

### Command: `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` (exit_code=0)
```text

> fe@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 30ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 3.3s
  Running TypeScript ...
  Finished TypeScript in 4.7s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/40) ...
  Generating static pages using 3 workers (10/40) 
  Generating static pages using 3 workers (20/40) 
  Generating static pages using 3 workers (30/40) 
✓ Generating static pages using 3 workers (40/40) in 1242ms
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
├   /visits/[id]/medical-record
│ └ ◐ /visits/[id]/medical-record
└ ○ /visits/new


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

