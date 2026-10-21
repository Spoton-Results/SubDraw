# Payment attempts: deployment hold

This patch is not production-verified. Do not merge or enable live payments until staging tests pass.

## Migration

The SQL file lib/db/migrations/20261021_payment_attempts.sql is a manually reviewed migration, not a wired automatic migration runner. Back up the target database, verify its identity and deployed schema, review the SQL, and apply it once with transaction/error-stop behavior before deploying this branch. Do not run push-force. A separate approval is required for database changes. The application fails closed if the new table is unavailable.

## Tests

From the workspace root, with dependencies installed:

    pnpm --filter @workspace/api-server exec tsx --test tests/payment-attempts.test.ts tests/payment-reconciliation.test.ts

These are pure-policy tests. They do not prove API authorization, database concurrency, webhook replay handling, or Stripe integration.

Before release, test simultaneous create requests, Stripe timeouts before and after object creation, lost browser callbacks, webhook-before-response ordering, repeated events, failed and processing ACH payments, changed invoice amounts, changed connected accounts, expired unresolved attempts, and cross-organization requests. Confirm one reserved attempt and one Stripe PaymentIntent per invoice.

## Deliberate holds

Retained invoices, canceled intents, legacy payment references without an attempt record, changed invoice snapshots, and unresolved creation attempts at least 23 hours old require manual reconciliation. Never delete an attempt or clear references to bypass a hold. No automatic second PaymentIntent is created for a canceled intent. The current per-user payment-recording guard still requires the original initiating user; another authorized user must rely on webhook reconciliation rather than substituting their identity.

This patch does not resolve refunds, disputes, bank payout reconciliation, financial scoreboard defects, session security, or private-file authorization. Keep payment attempts and invoice records during any application rollback; rolling back the application alone can reintroduce unsafe legacy creation.
