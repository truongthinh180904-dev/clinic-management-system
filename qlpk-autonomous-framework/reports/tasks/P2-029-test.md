# Automated Test Report — P2-029

- `RUN_ID`: `run-20261028010849-32432-16261`
- `TIMESTAMP`: `2026-10-28T01:15:37+0700`

| Command | Exit Code | Result |
|---|---:|---|
| `cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint && ./vendor/bin/pint --test` | `0` | `PASS` |
| `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` | `0` | `PASS` |

## Summary
- `OVERALL_TEST_RESULT`: `PASS`
- `EXIT_CODE`: `0`

### Command: `cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint && ./vendor/bin/pint --test` (exit_code=0)
```text
{"tool":"phpunit","result":"passed","tests":457,"passed":457,"assertions":4481,"duration_ms":45133}

  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ............

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 224 files  


  .....................................................
  .....................................................
  .....................................................
  .....................................................
  ............

  ───────────────────────────────────────────── Laravel  
    PASS   .................................. 224 files  
```

### Command: `cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build` (exit_code=0)
```text

> fe@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 29ms
- Cache Components enabled
- Partial Prefetching enabled
- Experiments (use with caution):
  ✓ agentFeedback

  Creating an optimized production build ...
✓ Compiled successfully in 1414ms
  Running TypeScript ...
  Finished TypeScript in 3.5s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/38) ...
  Generating static pages using 3 workers (9/38) 
  Generating static pages using 3 workers (18/38) 
  Generating static pages using 3 workers (28/38) 
✓ Generating static pages using 3 workers (38/38) in 1184ms
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

