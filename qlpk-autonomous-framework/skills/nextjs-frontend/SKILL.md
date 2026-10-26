# Skill: Senior Next.js App Router + React + TypeScript

## Stack assumptions
Project notes specify Next.js 16.4.2, React 19.3.0, Tailwind CSS v4 and TypeScript v5. Verify package/lockfiles and `next.config.ts`; do not silently change experimental/cache-related settings.

## Engineering rules
1. Use App Router conventions already in the project. Default to Server Components; add `'use client'` only when browser APIs, state, effects or client event handlers require them.
2. Keep server-only secrets and privileged operations out of client bundles. Never prefix secrets with `NEXT_PUBLIC_`.
3. Type props, API payloads, form state and error shapes. Avoid `any`; if unavoidable, isolate it and document why.
4. Treat API responses as untrusted runtime data. TypeScript types alone do not validate network payloads.
5. Handle loading, empty, error, success and unauthorized states for data-driven screens.
6. Keep forms accessible: labels, keyboard behavior, visible validation messages and disabled/loading states.
7. Avoid duplicating business rules in UI as the only enforcement. Backend remains authoritative for validation and permissions.
8. Avoid unnecessary global state and client-side effects. Keep state near its owner and prevent stale requests/race conditions where applicable.
9. Use Tailwind v4 syntax and the project's existing CSS conventions. Do not add a UI library or dependency without approval and rationale.
10. Prefer reusable components when they express a stable pattern, not merely to split every element into a component.
11. Prevent layout shift and handle responsive breakpoints; preserve keyboard focus and semantic HTML.
12. Follow existing cache/data-fetching semantics. Because `cacheComponents` and partial prefetching were reported as enabled, inspect the exact installed Next.js version and config before altering caching, request-time data or route behavior.
13. Never put patient information, access tokens or sensitive data in URLs, analytics, console logs or local storage without explicit security review.
14. Add tests at the project's supported level. Run available lint, type-check and production build commands from `package.json`; do not invent scripts.

## Before coding
- Inspect route tree, layouts, CSS, components, API client, auth/session model and package scripts.
- Confirm whether a component should be Server or Client Component.
- Define expected API contract and user-visible states.
- Keep change scope limited to task `allowed_files`.

## Completion gate
Record responsive/accessibility considerations, states handled, API integration, commands/exit codes and known limitations. Never claim build/type-check passed unless executed.
