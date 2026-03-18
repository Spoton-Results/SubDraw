# Overview

SubTracker is a subcontract management platform designed for the construction industry. It enables General Contractors (GCs) to create projects, invite subcontractors, manage bids, track change orders, and process invoices. Subcontractors can submit bids, propose change orders, and submit invoices. The platform aims to streamline the subcontracting workflow, enhance financial transparency, and improve project management for both GCs and subcontractors.

## User Preferences

I prefer concise and accurate responses. When suggesting code, provide the complete, runnable code rather than snippets. I value efficient and idiomatic TypeScript and React patterns. For any significant changes, please explain the rationale and potential impacts. I prefer an iterative development approach, focusing on one feature or fix at a time. Do not make changes to files outside the explicitly requested scope.

## System Architecture

The project is built as a pnpm monorepo using Node.js 24 and TypeScript 5.9. The backend is an Express 5 API server, and the frontend is a React + Vite application utilizing Tailwind CSS, React Query, React Hook Form, and shadcn/ui. PostgreSQL with Drizzle ORM is used for data persistence, with Zod for schema validation. API client code is generated from an OpenAPI specification using Orval.

**Key Architectural Decisions:**

-   **Monorepo Structure:** Organizes API server, frontend, and shared libraries (API spec, generated clients, database schema) for cohesive development.
-   **Authentication:** Cookie-based JWT authentication with bcryptjs for password hashing. Includes robust middleware for role-based access control (`requireAuth`, `requireGC`, `requireSub`, `requireGCOwner`). Features permanent sessions and password change session invalidation.
-   **Subcontractor Data Isolation:** Ensures strict data privacy for subcontractors, preventing them from viewing other subs' information or project details not relevant to their scope.
-   **Financial Tracking:** Implements comprehensive financial features including bid management, subcontract creation, change order processing, and invoice management with auto-flagging for over-budget invoices and a GC override mechanism.
-   **Retention Tracking:** Integrates a detailed retention framework, calculating retention amounts, displaying retention balances on a scoreboard, and supporting retention-release invoices.
-   **Bank Draw Schedule:** A GC-only feature allowing GCs to manage project budgets by defining cost categories, tracking committed amounts against budgets, and linking subcontracts to specific line items.
-   **Notification System:** Uses SendGrid for various email notifications triggered by key actions within the platform (e.g., bid awards, change order status changes, invoice submissions).
-   **UI/UX:** Uses Tailwind CSS for styling and shadcn/ui for components, ensuring a modern and consistent design. The frontend routes are structured for clear navigation between dashboards, project details, subcontract details, and administrative sections like contact management and team management.
-   **Demo System:** Includes a fully functional demo environment with seeded data that resets daily, allowing users to explore the platform's capabilities without registration.
-   **Free Trial:** Offers a 14-day free trial for GCs, providing full access to features before requiring a subscription.

## External Dependencies

-   **Database:** PostgreSQL (with Drizzle ORM)
-   **Email Service:** SendGrid (`@sendgrid/mail`)
-   **Payment Processing:** Stripe (for billing and subscriptions)
-   **Build Tool:** esbuild
-   **Frontend Tooling:** Vite
-   **API Codegen:** Orval (from OpenAPI spec)