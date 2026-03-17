# Workspace

## Overview

**SubTracker** — A subcontract management platform for the construction industry. General Contractors (GCs) create projects, invite subcontractors, manage bids, and track change orders and invoices. Subcontractors submit bids, propose change orders, and submit invoices.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, React Query, React Hook Form, shadcn/ui

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/        # Express 5 API server (auth, projects, bids, subcontracts, change orders, invoices)
│   └── subtracker/        # React + Vite frontend (served at /)
├── lib/
│   ├── api-spec/          # OpenAPI spec + Orval codegen config
│   ├── api-client-react/  # Generated React Query hooks
│   ├── api-zod/           # Generated Zod schemas from OpenAPI
│   └── db/                # Drizzle ORM schema + DB connection
├── scripts/               # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema (PostgreSQL)

- `users` — GC and SUB accounts (role, companyName, passwordHash, passwordResetToken, passwordResetExpires)
- `projects` — GC creates, status: BIDDING | ACTIVE | CLOSED; optional fields: address, description, estimatedStartDate (text), notes (GC-only, stripped from API response for non-GC users)
- `project_members` — Which subs are invited to a project
- `bids` — Subs submit bids; GC awards one → creates a subcontract
- `subcontracts` — Awarded contract with baseContractAmount
- `change_orders` — Proposed/approved scope changes; status: PENDING_GC | APPROVED | REJECTED
- `invoices` — Subs submit invoices; auto-flagged if over remaining budget; status: PENDING | APPROVED | REJECTED | FLAGGED. Professional PDF generated on every invoice action, attached to all email notifications and downloadable via GET /api/subcontracts/:id/invoices/:id/pdf
- `activity_logs` — Immutable audit trail per subcontract; fields: id, subcontractId, type, description, actorName, actorRole, createdAt. Written on every major action (subcontract created, CO created/approved/rejected, invoice submitted/flagged/approved/rejected/overridden/cancelled)
- `gc_contacts` — GC's contact book; auto-populated when a GC invites a sub to any project; unique on (gcId, subId); supports private notes
- `sub_profiles` — Sub's trade profile (trade, phone, businessAddress, licenseNumber); subs are forced to complete on first login via ProtectedRoute redirect

## Auth

- Cookie-based JWT auth via `/api/auth/*` routes
- bcryptjs password hashing
- `requireAuth`, `requireGC`, `requireSub` middleware in `artifacts/api-server/src/middlewares/requireAuth.ts`
- Password reset: `POST /auth/forgot-password` → generates token + sends email; `POST /auth/reset-password` → verifies token, sets new password
- Profile update: `PATCH /auth/update-profile` → updates companyName
- Force-change flow: `mustChangePassword` flag on users; `ProtectedRoute` renders inline `<ChangePassword>` if set

## Key Features

- **Scoreboard**: Live financial summary per subcontract (base + approved COs vs. invoiced)
- **Invoice auto-flagging**: Invoices over remaining contract amount are auto-flagged
- **Invoice override**: GC can override a flagged invoice with a reason

## Email Notifications

Uses SendGrid (`@sendgrid/mail`). Secrets: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`.
Note: Replit's SendGrid integration was dismissed — credentials provided manually as Replit Secrets instead.

Email triggers (all best-effort, non-blocking):
1. Sub invited to project (new account only) → send login + temp password
2. Existing contact added to project → send "added to project" notification
3. GC awards bid → email sub that their bid was accepted
4. GC creates change order → email sub to review and approve/reject
5. Sub approves/rejects change order → email GC with the decision
6. Sub submits invoice (normal) → email GC that invoice was submitted
7. Sub submits invoice (flagged over budget) → red-warning email to GC
8. GC approves/rejects/overrides invoice → email sub with the result

Change order flow: GC creates (status: PENDING_GC) → Sub approves/rejects (`requireSub` middleware).

## Routes (Frontend)

- `/login` — Login
- `/register` — Register (GC or SUB)
- `/` — Dashboard (projects list)
- `/projects/new` — Create project (GC only)
- `/projects/:id` — Project detail (members, bids, subcontracts)
- `/subcontracts/:id` — Subcontract detail (scoreboard, change orders, invoices)
- `/contacts` — GC Contact Book (GC-only; lists all subs ever invited, with trade profiles, notes, and "Add to Project" action)
- `/billing` — GC Billing page (GC-only; shows current plan, next billing date, cancel/reactivate, billing history; integrates with Stripe)
- Profile setup — inline in ProtectedRoute; shown to SUB users with `subProfile === null` before any protected page

## API Routes

All prefixed with `/api`

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` (includes subProfile for SUB users)
- `GET /users` — List all users
- `GET /projects`, `POST /projects`
- `GET /projects/:id`, `POST /projects/:id/invite` (auto-saves sub to GC contact book)
- `GET /projects/:id/bids`, `POST /projects/:id/bids`
- `POST /projects/:id/bids/:bidId/award` — Award bid, creates subcontract
- `GET /projects/:id/change-orders` — All COs across all subcontracts for a project (GC only, with sub company name)
- `POST /projects/:id/change-orders/bulk` — Create COs for multiple subcontracts at once; body: `{description, scope?, entries:[{subcontractId, amount}]}`
- `GET /projects/archived` — Archived projects list (GC only) — NOTE: must be declared before `/:projectId` in Express router
- `POST /projects/:id/archive`, `POST /projects/:id/unarchive`
- `GET /subcontracts`, `GET /subcontracts/:id`
- `GET/POST /subcontracts/:id/change-orders`
- `POST /subcontracts/:id/change-orders/:coId/approve|reject`
- `GET/POST /subcontracts/:id/invoices`
- `POST /subcontracts/:id/invoices/:invId/approve|reject|override`
- `GET /contacts` — GC contact book (GC-only)
- `PATCH /contacts/:subId` — Update note on a contact
- `DELETE /contacts/:subId` — Remove contact
- `POST /contacts/:subId/invite/:projectId` — Add existing contact to a project
- `GET /profile/me` — Get sub's own profile (SUB-only)
- `PUT /profile/me` — Upsert sub's trade profile (SUB-only)
- `GET /stripe/billing` — Get billing info (subscription + invoices) for GC
- `POST /stripe/checkout` — Create Stripe checkout session (returns URL)
- `POST /stripe/cancel-subscription` — Cancel subscription at period end
- `POST /stripe/reactivate-subscription` — Reactivate a cancelling subscription
- `GET /stripe/subscription-status` — Check if GC is subscribed

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from the root:
- `pnpm run typecheck` — full check

## Test Accounts (seeded during dev)

- GC: `gc@test.com` / `password123` (BuildCo GC)
- SUB: `sub@test.com` / `password123` (Electric Sub LLC)
