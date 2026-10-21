# Stripe API alignment: migration draft, not deployment approval

## Explicit behavior change

The three application-owned Stripe constructors in artifacts/api-server/src/lib/stripeClient.ts now request 2026-02-25.clover instead of 2025-05-28.basil. The target matches the literal version reported by the installed SDK in the verification run. This is a real request-version change, not a type assertion pretending the old version matches new types. No SDK dependency or lockfile was changed.

Basil-to-Clover is a major API-release migration. Matching constructor types does not establish runtime compatibility. Do not merge or deploy until the integration review and tests below are complete.

## What this commit does not do

It does not send a Stripe request, change account defaults, change webhook endpoint versions, create a charge, update connected accounts, execute database migrations, or deploy. Those actions require separate review and approval.

The direct-secret StripeSync path still creates its own internal client. This commit does not establish its API-version alignment. The existing Replit proxy integration and its existing any assertion were retained, not newly validated. Audit stripe-replit-sync's resolved version, internal client, managed webhook version, and database shape before release.

## Known compatibility work still required

- Billing routes use invoices.retrieveUpcoming(); verify the installed SDK's supported preview API and migrate the caller deliberately.
- Billing views and past-due grace calculations read subscription.current_period_end from synced database rows. Verify the sync engine's actual schema and subscription-item period fields; do not assume top-level fields remain available or silently substitute zero.
- Inspect all checkout, invoice, subscription, customer, connected-account, and PaymentIntent consumers for release-specific fields and behavior.
- Verify both the managed sync webhook and the Connect webhook with the payload versions actually configured in Stripe. A constructor pin does not change webhook payload versions.

## Required evidence before release

Require clean TypeScript checks and builds, plus test-mode integration evidence for subscription checkout, upgrades, cancellation/reactivation, annual renewals, past-due grace, invoice previews, account onboarding/restriction, direct charges, platform fees, retries, asynchronous payments, refunds, disputes, and webhook processing. Pure-policy unit tests alone are insufficient.

The payment-attempt database migration and remaining authorization, session, file-security, and scoreboard issues remain separate release blockers. Do not roll this branch into production merely because the constructor errors disappear. Rollback must preserve attempt records and reconcile outstanding payments; do not blindly clear payment state or change account/webhook versions.
