import { useGetMe } from "@workspace/api-client-react";

type GCTeamRole =
  | "owner"
  | "vp_operations"
  | "project_manager"
  | "project_engineer"
  | "superintendent"
  | "estimator"
  | "contract_administrator"
  | "accountant";

export interface Permissions {
  role: GCTeamRole | null;
  isGC: boolean;
  isSub: boolean;
  isOwner: boolean;
  canAccessBilling: boolean;
  canManageTeam: boolean;
  canApproveInvoices: boolean;
  canRejectInvoices: boolean;
  canApproveChangeOrders: boolean;
  canCreateChangeOrders: boolean;
  canInviteSubs: boolean;
  canCreateProjects: boolean;
  canSeeAllProjects: boolean;
  hasFinancialAccess: boolean;
  canDownloadFiles: boolean;
  canAccessCompliance: boolean;
  canViewBids: boolean;
  canConfirmCompletion: boolean;
  isBiddingOnly: boolean;
  canViewActionRequired: boolean;
  canArchiveProjects: boolean;
  canMarkProjectComplete: boolean;
}

export function usePermissions(): Permissions {
  const { data: user } = useGetMe();

  const isGC = user?.role === "GC";
  const isSub = user?.role === "SUB";
  const rawRole = (user as any)?.gcTeamRole as string | null | undefined;

  let role: GCTeamRole | null = null;
  if (isGC) {
    role = (rawRole as GCTeamRole) ?? "owner";
  }

  const isOwner = isGC && (role === "owner" || role === null);
  const isVP = role === "vp_operations";
  const isPM = role === "project_manager";
  const isPE = role === "project_engineer";
  const isSuperintendent = role === "superintendent";
  const isEstimator = role === "estimator";
  const isContractAdmin = role === "contract_administrator";
  const isAccountant = role === "accountant";

  return {
    role,
    isGC,
    isSub,
    isOwner,
    canAccessBilling: isOwner,
    canManageTeam: isOwner,
    canApproveInvoices: isOwner || isPM,
    canRejectInvoices: isOwner || isPM,
    canApproveChangeOrders: isOwner || isPM,
    canCreateChangeOrders: isOwner || isPM || isPE,
    canInviteSubs: isOwner || isPM,
    canCreateProjects: isOwner,
    canSeeAllProjects: isOwner || isVP || isContractAdmin || isAccountant,
    hasFinancialAccess: isOwner || isVP || isPM || isAccountant,
    canDownloadFiles: !isEstimator,
    canAccessCompliance: !isEstimator,
    canViewBids: isOwner || isPM || isEstimator || isVP,
    canConfirmCompletion: isOwner || isPM || isSuperintendent,
    isBiddingOnly: isEstimator,
    canViewActionRequired: isOwner || isVP || isPM,
    canArchiveProjects: isOwner,
    canMarkProjectComplete: isOwner || isPM,
  };
}

export const GC_TEAM_ROLE_META: Record<GCTeamRole, { label: string; description: string; color: string; badge: string }> = {
  owner: {
    label: "Owner",
    description: "Full access to everything — billing, all projects, all financials, team management, archive projects, and all reports.",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    badge: "amber",
  },
  vp_operations: {
    label: "VP of Operations",
    description: "View-only access to all projects and financials. Receives alerts for flagged invoices, disputes, over-budget projects, and expiring insurance. Can view Action Required dashboard. Cannot approve, reject, or create anything. Cannot manage team or billing.",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    badge: "purple",
  },
  project_manager: {
    label: "Project Manager",
    description: "Full management of assigned projects — invite subs, create change orders, approve and reject invoices, override flagged invoices with reason, manage compliance checklists, upload documents, mark projects complete, view and download lien waivers. No billing or team management access.",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    badge: "blue",
  },
  project_engineer: {
    label: "Project Engineer",
    description: "Assigned projects only. Can view all subcontracts, invoices, and change orders, add comments, upload documents, and create draft change orders for PM approval. Cannot approve or reject invoices or change orders. Cannot see financial dollar amounts on scoreboard. No billing or team access.",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
    badge: "cyan",
  },
  superintendent: {
    label: "Superintendent",
    description: "Assigned projects only. Can view subcontract details and submitted invoices, confirm or dispute percentage complete on pending invoices, add comments, and upload site photos. Cannot approve or reject invoices financially. Cannot see scoreboard dollar amounts. No billing or team access.",
    color: "bg-green-100 text-green-800 border-green-200",
    badge: "green",
  },
  estimator: {
    label: "Estimator",
    description: "Assigned projects — bidding phase only. Can view all submitted bids, bid amounts, scope notes, plan files, and scope documents. Can do bid leveling comparison and add notes on bids. Cannot accept bids. No access once project moves to construction. Cannot see construction financials.",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    badge: "orange",
  },
  contract_administrator: {
    label: "Contract Administrator",
    description: "All projects — document and compliance access only. Can view and upload subcontract agreements, track signed contract status, manage insurance certificates, manage compliance checklists, view and download lien waivers, track expiry dates, and send compliance reminders. Cannot approve or reject invoices or change orders. Cannot see financial scoreboard amounts.",
    color: "bg-rose-100 text-rose-800 border-rose-200",
    badge: "rose",
  },
  accountant: {
    label: "Accountant",
    description: "All projects — financial view only. Can view all invoices, payment status, scoreboard numbers, retention balances, and change order amounts. Can download all PDFs, lien waivers, and export CSV for QuickBooks and Xero. Cannot approve, reject, or create anything. No billing or team management.",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    badge: "slate",
  },
};

export const ROLE_ORDER: GCTeamRole[] = [
  "owner",
  "vp_operations",
  "project_manager",
  "project_engineer",
  "superintendent",
  "estimator",
  "contract_administrator",
  "accountant",
];
