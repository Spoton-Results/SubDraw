# Security verification: scope and limits

The workflow .github/workflows/subdraw-security-verification.yml runs on pushes to fix/payment-route-security, pull requests targeting master, and manual dispatch when GitHub makes that trigger available. GitHub Actions must be enabled and the setup actions must be permitted. A commit can consume Actions allowance; a workflow file alone is not evidence that a run started or passed.

It installs frozen-lockfile dependencies, executes the payment-policy tests, compiles referenced libraries, directly invokes TypeScript for API and frontend source, and builds each application only after its own typecheck passes. The API and frontend package-level typecheck scripts remain unchanged; the workflow deliberately bypasses their existing echo-only commands.

Independent checks are attempted after earlier check failures when prerequisites succeeded, and failures are not ignored. Inspect skipped checks as well as failures. Existing repository errors may prevent a clean run. Do not weaken compiler rules, bypass errors, or treat a successful bundle as proof of type safety.

The workflow has contents:read permissions and does not request deployment, database, or Stripe secrets. It does not run the application, apply migrations, call Stripe, merge changes, publish artifacts, or deploy. Dependencies are installed on the GitHub-hosted runner. No PostgreSQL service or application database URL is configured.

A green result proves only the checks actually executed on the recorded commit. The current tests cover pure payment-matching, amount, retry-age, and status-transition policies. They are not API authorization, database, concurrency, or end-to-end payment tests.

Before any release, separately verify the payment-attempt migration in a disposable database and test authorization, simultaneous requests, Stripe idempotency, unknown outcomes, ACH processing/failures, duplicate and out-of-order events, and callback/webhook races. Authentication, private-file authorization, scoreboard accuracy, refunds, disputes, and bank payout reconciliation remain separate release considerations.

Do not merge or deploy this security branch solely because this workflow is green. Require reviewed integration-test evidence and the separately approved migration and deployment plan.
