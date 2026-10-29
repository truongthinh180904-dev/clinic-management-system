# Automated Test Report — P3-030

- `RUN_ID`: `run-20261029113902-20344-28978`
- `TIMESTAMP`: `2026-10-29T11:44:56+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `test -s "$PROJECT_ROOT/docs/phase-3/PHASE_3_REPORT.md"` | `0` | `PASS` |
| `test -s "$PROJECT_ROOT/docs/phase-3/OPERATIONAL_GUIDE.md"` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && php artisan test` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `test -s "$PROJECT_ROOT/docs/phase-3/PHASE_3_REPORT.md"` (exit_code=0)
```text

```

### Command: `test -s "$PROJECT_ROOT/docs/phase-3/OPERATIONAL_GUIDE.md"` (exit_code=0)
```text

```

### Command: `cd "$PROJECT_ROOT/be" && php artisan test` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":603,"passed":603,"assertions":5559,"duration_ms":73863}
```

### Command: `cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test` (exit_code=0)
```text

  ........................................................................................
  ........................................................................................
  ............................................................................

  ──────────────────────────────────────────────────────────────────────────────── Laravel  
    PASS   ..................................................................... 252 files  
```

### Command: `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` (exit_code=0)
```text

> fe@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 37ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 3.6s
  Running TypeScript ...
  Finished TypeScript in 4.8s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/42) ...
  Generating static pages using 3 workers (10/42) 
  Generating static pages using 3 workers (20/42) 
  Generating static pages using 3 workers (31/42) 
✓ Generating static pages using 3 workers (42/42) in 1800ms
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
├ ○ /audit-logs
├ ○ /cash-book
├ ○ /dashboard
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

