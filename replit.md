# Overview

SubTracker is a subcontract management platform for the construction industry, designed to streamline workflows, enhance financial transparency, and improve project management for General Contractors (GCs) and subcontractors. It allows GCs to manage projects, bids, change orders, and invoices, while subcontractors can submit bids and invoices. The platform offers a demo system with seeded data and a 14-day free trial, aiming to provide a comprehensive solution for subcontracting needs.

# User Preferences

I prefer concise and accurate responses. When suggesting code, provide the complete, runnable code rather than snippets. I value efficient and idiomatic TypeScript and React patterns. For any significant changes, please explain the rationale and potential impacts. I prefer an iterative development approach, focusing on one feature or fix at a time. Do not make changes to files outside the explicitly requested scope.

# System Architecture

The project is built as a pnpm monorepo using Node.js 24 and TypeScript 5.9. The backend is an Express 5 API server, and the frontend is a React + Vite application utilizing Tailwind CSS, React Query, React Hook Form, and shadcn/ui. PostgreSQL with Drizzle ORM handles data persistence, and Zod is used for schema validation. API client code is generated from an OpenAPI specification using Orval.

**Key Architectural Decisions:**

-   **Monorepo Structure:** Organizes API server, frontend, and shared libraries for cohesive development.
-   **Authentication:** Cookie-based JWT authentication with bcryptjs for password hashing, including robust role-based access control and permanent sessions.
-   **Data Isolation:** Ensures strict data privacy for subcontractors.
-   **Financial Tracking:** Comprehensive features for bid management, subcontract creation, change order processing, and invoice management with budget flagging and retention tracking.
-   **Bank Draw Schedule:** GC-only feature for managing project budgets and linking subcontracts to line items.
-   **Notification System:** Email notifications for key platform actions.
-   **UI/UX:** Modern and consistent design using Tailwind CSS and shadcn/ui, with structured routing.
-   **Action Required Dashboard:** A consolidated panel for GCs to track all urgent, pending, and upcoming actions across projects.
-   **Project Completion Flow:** A structured process for marking projects complete, including document uploads, photo evidence, completion notes, and retention confirmation.
-   **Project Owner & CO Notification System:** Allows GCs to add project owners who receive notifications for change orders exceeding a set threshold, with options to approve or reject via secure links.
-   **Contact Book Bulk Import:** GCs can import subcontractor contacts via CSV or manual entry, with duplicate detection.
-   **Compliance Management:** Features for additional insurance requirements, contractor license tracking, and a project-level compliance checklist for subcontractors.
-   **Communication:** A per-subcontract messaging system with read-tracking and email notifications.
-   **GC Credentials:** GCs can upload their insurance certificates and contractor licenses, which are visible to subcontractors and include expiry tracking and notifications.
-   **AI Bid Intelligence:** GCs can leverage AI (Claude) to analyze plan files and generate trade-by-trade bid range benchmarks, enhancing bid comparison without exposing AI data to subcontractors.
-   **Billing & Pricing:** Subscription tiers based on active subcontract count, with blocking mechanisms for exceeding limits and a dedicated billing page for plan management.
-   **Super Admin Dashboard:** A separate, isolated internal portal for platform administration, offering detailed metrics, user management (impersonation, pausing accounts), revenue tracking, feature flag management, and support tools.

# External Dependencies

-   **Database:** PostgreSQL
-   **Email Service:** SendGrid
-   **Payment Processing:** Stripe
-   **AI Services:** Claude (for AI Bid Intelligence)
-   **Build Tool:** esbuild
-   **Frontend Tooling:** Vite
-   **API Codegen:** Orval