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

- `users` — GC and SUB accounts (role, companyName, passwordHash, passwordResetToken, passwordResetExpires, `isDemo` boolean, `displayName` for PMs, `gcParentId` FK to owner userId for team members, `gcTeamRole`: "owner" | "project_manager" for GC team members)
- `gc_project_assignments` — Maps GC team members (PMs) to specific projects they can access: (teamMemberUserId, projectId)
- `projects` — GC creates, status: BIDDING | ACTIVE | CLOSED; optional fields: address, description, estimatedStartDate (text), notes (GC-only, stripped from API response for non-GC users)
- `project_members` — Which subs are invited to a project
- `bids` — Subs submit bids; GC awards one → creates a subcontract. Fields: `amount`, `notes`, `status` (PENDING|AWARDED|REJECTED), `scopeOfWorkObjectPath` (optional file upload path via object storage)
- `subcontracts` — Awarded contract with baseContractAmount, `retentionPercentage` (0–15%, default 10%)
- `change_orders` — Proposed/approved scope changes; status: PENDING_GC | APPROVED | REJECTED
- `invoices` — Subs submit invoices; auto-flagged if over remaining budget; status: PENDING | APPROVED | REJECTED | FLAGGED. Fields: `retentionAmount` (calculated on approval, null for retention-release invoices), `isRetentionRelease` (boolean). Professional PDF generated on every invoice action, attached to all email notifications and downloadable via GET /api/subcontracts/:id/invoices/:id/pdf; PDFs show retention line items (Retention Held, Net Payable Now)
- `activity_logs` — Immutable audit trail per subcontract; fields: id, subcontractId, type, description, actorName, actorRole, createdAt. Written on every major action (subcontract created, CO created/approved/rejected, invoice submitted/flagged/approved/rejected/overridden/cancelled)
- `gc_contacts` — GC's contact book; auto-populated when a GC invites a sub to any project; unique on (gcId, subId); supports private notes
- `sub_profiles` — Sub's trade profile (trade, phone, businessAddress, licenseNumber); subs are forced to complete on first login via ProtectedRoute redirect

## Auth

- Cookie-based JWT auth via `/api/auth/*` routes
- bcryptjs password hashing
- `requireAuth`, `requireGC`, `requireSub`, `requireGCOwner` middleware in `artifacts/api-server/src/middlewares/requireAuth.ts`
  - `requireGCOwner` — blocks GC team members (PMs) from owner-only routes (billing, team management, project creation, etc.)
- Auth helpers in `artifacts/api-server/src/lib/auth.ts`:
  - `getEffectiveGcId(user)` — returns owner's userId for PMs, own userId for owners
  - `isProjectManager(user)` — returns true for PM team members
  - `isGCOwner(user)` — returns true for GC owners (not PMs)
  - `getActorName(user)` — returns `displayName` for PMs, `companyName` for owners (used in activity logs)
- Password reset: `POST /auth/forgot-password` → generates token + sends email; `POST /auth/reset-password` → verifies token, sets new password
- Profile update: `PATCH /auth/update-profile` → updates companyName
- Force-change flow: `mustChangePassword` flag on users; `ProtectedRoute` renders inline `<ChangePassword>` if set

## Sub Privacy Model

Subs have strict data isolation — they must never see other subs on the same project:
- `GET /api/projects/:id` — for SUB users, the response omits the `members` array entirely and filters `bids` and `subcontracts` to only the requesting sub's own records
- `GET /api/projects/:id/bids` — requires `requireGC`; returns 403 to subs
- `GET /api/users` — requires `requireGC`; returns 403 to subs
- Project detail UI: "Project Members" sidebar is wrapped in `{isGC && (...)}` so it never renders for subs; the layout grid collapses to full-width for subs

## Key Features

- **Scoreboard**: Live financial summary per subcontract (base + approved COs vs. invoiced)
- **Invoice auto-flagging**: Invoices over remaining contract amount are auto-flagged
- **Invoice override**: GC can override a flagged invoice with a reason
- **Retention tracking**: GC sets a retention rate (0–15%, default 10%) when awarding a bid. `retentionAmount` is computed and stored on each invoice approval. Scoreboard shows Gross Invoiced, Total Retention Held, Net Paid, Retention Balance. On CLOSED projects, GC can click "Release Retention" to create a final retention-release invoice (`isRetentionRelease: true`). PDF invoices show retention line items and net payable. Activity log records `RETENTION_RELEASED` events.

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
- `/` — Dashboard (projects list; "New Project" button hidden from PMs)
- `/projects/:id` — Project detail (members, bids, subcontracts)
- `/subcontracts/:id` — Subcontract detail (scoreboard, change orders, invoices)
- `/contacts` — GC Contact Book (owner-only; lists all subs ever invited)
- `/team` — GC Team Management (owner-only; invite/edit/remove PMs, assign projects)
- `/billing` — GC Billing page (owner-only; shows current plan, cancel/reactivate, billing history; Stripe)
- Profile setup — inline in ProtectedRoute; shown to SUB users with `subProfile === null` before any protected page

### ProtectedRoute Props
- `gcOnly` — redirects non-GC users to `/`
- `ownerOnly` — redirects GC team members (PMs) AND non-GC users to `/`

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
- `POST /subcontracts/:id/release-retention` — GC only; project must be CLOSED; retentionBalance > 0; creates a retention-release invoice for the full retentionBalance
- `GET /contacts` — GC contact book (GC-only)
- `PATCH /contacts/:subId` — Update note on a contact
- `DELETE /contacts/:subId` — Remove contact
- `POST /contacts/:subId/invite/:projectId` — Add existing contact to a project
- `GET /profile/me` — Get sub's own profile (SUB-only)
- `PUT /profile/me` — Upsert sub's trade profile (SUB-only)
- `GET /stripe/billing` — Get billing info (subscription + invoices) for GC owner only (`requireGCOwner`)
- `POST /stripe/checkout` — Create Stripe checkout session (returns URL) — owner only
- `POST /stripe/cancel-subscription` — Cancel subscription at period end — owner only
- `POST /stripe/reactivate-subscription` — Reactivate a cancelling subscription — owner only
- `GET /stripe/subscription-status` — Check if GC is subscribed (returns bypass response for demo accounts)
- `POST /auth/demo-login` — Log in as demo GC or SUB (no password required; body: `{role: "GC"|"SUB"}`)
- `GET /team` — List all GC team members with assigned projects (owner only)
- `POST /team/invite` — Invite new PM: body `{email, fullName, gcTeamRole}` → creates user, sends email with temp password (owner only)
- `PATCH /team/:memberId` — Update PM's name or role (owner only)
- `DELETE /team/:memberId` — Remove PM and all their project assignments (owner only)
- `GET /team/projects/:projectId/members` — List PMs assigned to a project (owner only)
- `POST /team/projects/:projectId/assign` — Assign PM to a project; body: `{teamMemberUserId}` (owner only)
- `DELETE /team/projects/:projectId/assign/:teamMemberUserId` — Unassign PM from a project (owner only)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from the root:
- `pnpm run typecheck` — full check

## Demo System

- **Demo GC**: `demo-gc@subtracker.com` (Harbor View Construction Co.) — `isDemo: true`
- **Demo Sub**: `demo-sub@subtracker.com` (Pacific Electric Inc.) — `isDemo: true`
- Demo data reset every 24h via `startDemoSeeder()` in `artifacts/api-server/src/lib/demoSeeder.ts`
- Demo project: "Harbor View Office Renovation" (CONSTRUCTION) with 3 subcontracts (Electrical $45k, Plumbing $28k, Drywall $32k), change orders, invoices (including 1 FLAGGED), a signed lien waiver, and drywall insurance expiring in 15 days
- Demo emails suppressed via Proxy in `email.ts` that intercepts calls to `toEmail` matching `demo-.*@subtracker.com`
- Demo accounts bypass Stripe subscription-status and project creation limit checks
- Demo banner shown in Layout when `user.isDemo === true`
- Login page has "Demo as GC" and "Demo as Sub" buttons (no password required)

## Free Trial

- 14-day free trial starts at registration (no credit card required)
- `trialStartedAt` column on users defaults to `now()`; `getGCPlanInfo()` computes `trialActive`, `trialExpired`, `trialDaysLeft`
- During trial: GC has full access (subscribed=true, limit=null)
- After trial: TrialExpiredGate blocks access until a plan is chosen
- TrialBanner shown when `trialActive && !planName`: blue (7+ days left), yellow (<7 days), red (<3 days)

## Test Accounts (seeded during dev)

- GC: `gc@test.com` / `password123` (BuildCo GC)
- SUB: `sub@test.com` / `password123` (Electric Sub LLC)
