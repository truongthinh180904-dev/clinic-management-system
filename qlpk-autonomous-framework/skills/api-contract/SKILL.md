# Skill: Frontend/Backend API Contract

1. Define request method/path, authentication, authorization, request schema, success schema, error schema and status codes before implementing both ends.
2. Use one agreed naming convention and date/time format. Do not guess field names or clinical business rules.
3. Distinguish `400`/`401`/`403`/`404`/`409`/`422`/`429`/`500` according to established project conventions; verify the actual response mapping.
4. Validation errors must be machine-readable and safe to display. Internal exception details remain server-side.
5. Do not return more patient/user data than the screen needs. Apply resource-level authorization and clinic/tenant scope on the server.
6. Document pagination, sorting, filtering, empty results and concurrency behavior for list/update flows.
7. Avoid breaking changes without versioning or explicit coordination. Update API tests and FE types together when contract changes.
8. Do not let frontend types be the sole source of truth for security or validation.
9. For a new endpoint, add tests for unauthenticated, unauthorized, invalid payload, not-found, success and relevant conflict/edge cases.
10. If OpenAPI or generated clients already exist, inspect and follow them rather than creating a parallel contract.
