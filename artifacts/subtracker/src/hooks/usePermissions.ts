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
  };
}

export const GC_TEAM_ROLE_META: Record<GCTeamRole, { label: string; description: string; color: string; badge: string }> = {
  owner: {
    label: "Owner",
    description: "Full access to everything including billing, all projects, all financials, and team management.",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    badge: "amber",
  },
  vp_operations: {
    label: "VP of Operations",
    description: "Read access to all projects and financials. Receives alerts for flagged invoices and disputes. Cannot edit billing or team settings.",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    badge: "purple",
  },
  project_manager: {
    label: "Project Manager",
    description: "Full management of assigned projects. Can create change orders, approve invoices, and invite subs. No billing access.",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    badge: "blue",
  },
  project_engineer: {
    label: "Project Engineer",
    description: "Assigned projects only. Can view, comment, and process change orders and submittals. Cannot approve invoices or access financials.",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
    badge: "cyan",
  },
  superintendent: {
    label: "Superintendent",
    description: "Assigned projects only. Can view subcontracts and invoices, and confirm work completion percentage. Cannot approve or reject invoices.",
    color: "bg-green-100 text-green-800 border-green-200",
    badge: "green",
  },
  estimator: {
    label: "Estimator",
    description: "Bidding phase only on assigned projects. Can view bids and perform bid leveling. No access to construction phase financials.",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    badge: "orange",
  },
  contract_administrator: {
    label: "Contract Administrator",
    description: "Access to all compliance documents, insurance, lien waivers, and subcontracts across all projects. No financial approval access.",
    color: "bg-rose-100 text-rose-800 border-rose-200",
    badge: "rose",
  },
  accountant: {
    label: "Accountant",
    description: "Read-only access to all financial data across all projects. Can download PDFs and CSV exports. Cannot create or approve anything.",
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
