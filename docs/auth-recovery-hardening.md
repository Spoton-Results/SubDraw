# Auth recovery: source changes pending integration verification

## Included

Magic-link verification now locks the user row, checks current suspension and password-change state, conditionally consumes only an unused/unexpired token, and generates the session inside the same transaction. The conditional update is the one-winner gate; a successful request cannot reuse a consumed link. This implementation still requires real PostgreSQL replay and simultaneous-request tests.

New links requested through /auth/magic-link/request expire after 15 minutes, and paused accounts receive no new link from that endpoint. Invitation links created elsewhere and existing stored links retain their recorded expiration, but the verify endpoint still enforces one-time consumption, expiry, and account checks. This is not a claim that every invitation issuer has been hardened.

Registration, password login, current-user lookup, profile update, and demo login use a shared serializer that removes passwordHash, passwordResetToken, passwordResetExpires, and adminNotes. This is explicit exclusion of known fields, not an allowlist audit of every endpoint. Admin and other user-returning routes remain separate review targets.

Manual password changes and initial password setup clear outstanding reset fields. Password reset performs a conditional final update requiring the same still-present, unexpired token, so two concurrent submissions cannot both succeed through that update. Broader password-change races and session revocation need integration tests.

Demo login requires the named account to be an active demo account. Auth responses use no-store and no-referrer headers.

## Tests and limits

Six recovery/serialization policy tests were added to the existing session test file already invoked by CI. These do not prove database locking, email delivery, HTTP route behavior, or browser behavior. No tests have been verified passing on this commit at preparation time.

Verify a successful link, a replay, simultaneous consumption, expiry during verification, paused/deleted users, a link predating a password change, concurrent reset submissions, reset invalidation after manual password change, and absence of secret fields in HTTP responses.

GET-based magic-link consumption remains compatible with the current email URLs, but email scanners can consume such links. A confirmation-page/POST exchange and login-CSRF protection remain open design work. Recovery tokens are still stored in plaintext. Rate limiting, configured-origin enforcement for recovery links, CORS/CSRF protections, and persistent logout revocation remain open. Do not treat this patch as completion of authentication security.

No schema migration, email delivery, production-secret change, deployment, or merge is performed by committing these files. Require clean CI and integration evidence before rollout.
