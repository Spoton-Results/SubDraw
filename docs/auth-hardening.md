# Authentication core: rollout hold

This is an authentication-core patch, not completion of all security work. Tests are authored, not yet verified passing on this commit. Do not merge or deploy until compiler, session, permission, and browser regression evidence is reviewed.

## Deliberate changes

- JWT_SECRET must contain at least 32 bytes. Importing the server auth module fails without that configuration. No secret is created, rotated, or written by this commit.
- New user sessions expire after seven days; new admin sessions expire after eight hours. Tokens require the new purpose, audience, issuer, version, lifetime, and issued-at fields. Legacy sessions are rejected, so users and administrators must sign in again after rollout.
- User and admin token purposes are distinct. Admin verification requires the current configured ADMIN_EMAIL.
- Every protected user request reloads identity, role, parent organization, pause state, and password-change time from the database. Database failures deny the request rather than allow it.
- Password-change invalidation uses millisecond issue times to avoid comparing a freshly issued token against a truncated second.
- Unknown GC role configurations and parented owner claims fail closed rather than default to owner.
- Impersonation requires a current admin cookie and matching unended database audit record. It is read-only on protected user routes. Ending impersonation and logout routes remain separate existing routes.
- Setting an auth cookie appends headers instead of discarding unrelated Set-Cookie headers. Existing host/domain clearing behavior is retained.

## Required testing

The workflow includes isolated token/role tests with test-only environment values. They do not connect to a database or Stripe. API integration tests must still cover deleted users, suspended users and owners, role demotion, password changes within a second, expired admin sessions, ended/mismatched impersonation records, read-only impersonation, and multi-organization access. Browser tests must cover re-login, password change/set/reset, cookie domains, and admin exit.

## Remaining blockers

Magic-link consumption, auth-response field exposure, reset-token storage and races, rate limiting, CSRF/CORS controls, persistent per-session logout revocation, endpoint-specific permissions, and private-file authorization still require work. Stateless JWT logout only clears the browser cookie; it does not revoke a copied token. Some GET handlers may themselves mutate state and must be audited before describing impersonation as universally side-effect-free. Read-only method restrictions do not solve that existing design issue.

This patch has no deployment, database migration, or production-secret operation. Railway configuration must be checked separately before rollout.
