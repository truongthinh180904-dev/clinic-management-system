# Skill: Senior Laravel API Engineering

## Stack assumptions
Project notes specify PHP ^8.3, Laravel ^13.17 and PHPUnit ^12.5. Verify actual lockfiles and app structure before using version-specific APIs. Do not assume `routes/api.php` exists until checked.

## Engineering rules
1. Follow existing Laravel conventions and the smallest viable change. Use Form Requests or the established validation pattern for non-trivial request validation.
2. Keep controllers thin: request validation/authorization and HTTP mapping at the boundary; domain/business logic in an appropriate service/action when complexity justifies it. Avoid unnecessary abstraction for trivial flows.
3. Use Eloquent relationships deliberately; prevent N+1 with eager loading where evidence indicates it. Select only needed columns and paginate list endpoints.
4. Use database transactions for multi-step writes that must be atomic. Do not put slow external calls inside transactions unless justified.
5. Define explicit authorization policies/gates for protected resources. Authentication is not authorization. Never rely on FE-only route guards.
6. Use consistent JSON response and error conventions already present in the repo. Check Laravel exception handling and API bootstrap before changing them.
7. Validate types, bounds, enum values, ownership and cross-field rules. Never trust client-supplied user IDs, roles, prices, statuses or tenant/clinic scope.
8. Use mass assignment protection (`fillable`/`guarded`) intentionally; do not use unrestricted mass assignment with user input.
9. Avoid leaking exception messages, SQL, paths, tokens or patient data in API responses/logs.
10. Write feature tests for HTTP behavior, validation, authorization, success/error cases; unit-test isolated domain rules where worthwhile.
11. Keep migrations reversible and minimal. Never use destructive migrations, `migrate:fresh`, `db:wipe`, or production migration commands without explicit approval.
12. Use factories/seeders with synthetic data only. Never copy real patient data into fixtures.
13. Use Pint if the repo's configured script/tool supports it; do not invent composer scripts.
14. Keep business dates/time zones explicit. Store timestamps consistently and format for the user's configured timezone at presentation boundaries.
15. Use precise decimal/database types for money; never floating-point arithmetic for financial values.

## Before coding
- Inspect route registration, middleware, exception handling, model conventions, migrations and tests.
- Confirm whether API installation is present.
- Identify allowed files and existing response envelope.
- Ask for clarification if business rules are ambiguous.

## Completion gate
Report changed files, commands and exit codes, tests added, authorization/validation coverage, migration/data impact, and unresolved risks. Never claim success without execution evidence.
