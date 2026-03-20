# Overview

SubTracker is a subcontract management platform designed for the construction industry. It enables General Contractors (GCs) to create projects, invite subcontractors, manage bids, track change orders, and process invoices. Subcontractors can submit bids, propose change orders, and submit invoices. The platform aims to streamline the subcontracting workflow, enhance financial transparency, and improve project management for both GCs and subcontractors. It includes a demo system with seeded data and offers a 14-day free trial.

## User Preferences

I prefer concise and accurate responses. When suggesting code, provide the complete, runnable code rather than snippets. I value efficient and idiomatic TypeScript and React patterns. For any significant changes, please explain the rationale and potential impacts. I prefer an iterative development approach, focusing on one feature or fix at a time. Do not make changes to files outside the explicitly requested scope.

## System Architecture

The project is built as a pnpm monorepo using Node.js 24 and TypeScript 5.9. The backend is an Express 5 API server, and the frontend is a React + Vite application utilizing Tailwind CSS, React Query, React Hook Form, and shadcn/ui. PostgreSQL with Drizzle ORM is used for data persistence, with Zod for schema validation. API client code is generated from an OpenAPI specification using Orval.

**Key Architectural Decisions:**

-   **Monorepo Structure:** Organizes API server, frontend, and shared libraries for cohesive development.
-   **Authentication:** Cookie-based JWT authentication with bcryptjs for password hashing, including robust role-based access control and permanent sessions.
-   **Subcontractor Data Isolation:** Ensures strict data privacy for subcontractors.
-   **Financial Tracking:** Comprehensive features for bid management, subcontract creation, change order processing, and invoice management with budget flagging and retention tracking.
-   **Bank Draw Schedule:** GC-only feature for managing project budgets and linking subcontracts to line items.
-   **Notification System:** Email notifications via SendGrid for key platform actions.
-   **UI/UX:** Modern and consistent design using Tailwind CSS and shadcn/ui, with structured routing.
-   **Action Required Dashboard:** A consolidated panel for GCs to track all urgent, pending, and upcoming actions across projects.
-   **Payment Terms & Due Dates:** Configurable payment terms with automated due date calculation and visual urgency indicators.
-   **Plan File Download Tracking:** Records and displays subcontractor downloads of plan files, influencing bid status and compliance.
-   **Percentage Complete on Invoices:** Required field for subcontractors to report scope completion, with GC visibility, progress tracking, and inconsistency warnings.
-   **Project Completion Flow:** The "Mark Project Complete" button is positioned above the Private Notes section (bottom of the main content area) inside a green call-to-action card. Clicking it opens a checklist modal with four sections: (1) Upload Completion Documents (PDFs, docs — final inspection report, certificate of occupancy, punch list sign-off), (2) Upload Photos of Completed Work (images), (3) Completion Note textarea (optional), and (4) Subcontract Retention confirmation (radio: "All retention has been released" OR "Mark as waived" — required). The confirm button is disabled until a retention option is selected. On confirmation: uploaded files are registered via `POST /api/projects/:id/completion-documents`, then the project is marked COMPLETE via `POST /api/projects/:id/complete` with `{ completionNote, retentionWaived }`. A "Project Completion Record" card appears on the page once status is COMPLETE or archived, showing the completion note, a color-coded retention status badge (Released or Waived), and a grid of all uploaded completion documents with download links. New DB table: `project_completion_documents` (id, projectId, fileName, objectPath, fileSize, category, label, uploadedBy, createdAt). New columns on `projects`: `completion_note` (text), `retention_waived` (boolean).
-   **Project Owner & CO Notification System:** GC can add a Project Owner (property owner or developer) to each project by entering a name and email — no SubTracker account is needed. A CO Notification Threshold (dollar amount) is set per project; when a change order at or above that amount is created by the GC or approved by the sub, the owner receives a branded email showing the CO description, amount, previous project budget, new budget, and budget impact. Two CTA buttons — "Approve Change Order" (green) and "Reject Change Order" (red) — use secure single-use token links that open a public, auth-free response page. Owner replies are recorded in the `owner_co_notifications` table and logged in the subcontract activity history with role "OWNER". Duplicate notifications are prevented (one notification per CO per owner). The Project Owner section appears in the project detail right sidebar alongside Project Members, showing owner name, email, threshold, and a scrollable notification history with response status badges (Approved/Rejected/Pending). New DB tables: `owner_co_notifications` (stores token, ownerResponse, ownerResponseAt). New columns on `projects`: `owner_name`, `owner_email`, `owner_co_threshold`. Trigger points: single CO creation (GC role), bulk CO creation, and sub approval of GC-created COs.
-   **Contact Book Bulk Import:** GCs can import subcontractor contacts via CSV or manual entry, with duplicate detection and user account creation/upsertion.
-   **Additional Insurance Requirements:** GCs can specify detailed insurance requirements per subcontract beyond standard coverage, displayed as a consolidated checklist for subs.
-   **Contractor License Tracking:** Records and tracks contractor license details per subcontract, with status badges, update functionality, and expiration notifications.
-   **Subcontract Agreement Document Upload:** Replaced electronic signatures with a document upload workflow for GC agreements and signed subcontractor returns, including status tracking and waivers.
-   **Multi-file Plan Upload & Scope Documents:** Supports multi-file uploads for both project plans and scope of work documents, with tracking and visibility for subcontractors in bid forms.
-   **Compliance Checklist:** A project-level system for GCs to define required tasks and documents that subcontractors must complete before invoicing, with document upload support and status tracking.
-   **Comment Thread (Messages):** A per-subcontract messaging system for direct communication, including read-tracking, email notifications, and unread message indicators.
-   **GC Credentials (Insurance & License):** GCs enter their own insurance certificate and contractor license details once per project. Both are automatically visible to all subcontractors on their subcontract detail pages. Supports PDF document upload (cert and license doc). Expiry badges: green Valid / yellow Expiring in Xd / red Expired. GC project page shows a warning badge if credentials are incomplete or expiring. Sub views show a red warning banner if any GC credential is expired. Automated email notifications (30-day and 7-day warnings) are sent to the GC before expiry. New DB table: `gc_project_credentials` (one row per project). New API: `GET/PUT /api/projects/:projectId/gc-credentials`, `GET /api/projects/:projectId/gc-credentials/download/:type`, `DELETE /api/projects/:projectId/gc-credentials/document/:type`.

## External Dependencies

-   **Database:** PostgreSQL (with Drizzle ORM)
-   **Email Service:** SendGrid
-   **Payment Processing:** Stripe
-   **Build Tool:** esbuild
-   **Frontend Tooling:** Vite
-   **API Codegen:** Orval