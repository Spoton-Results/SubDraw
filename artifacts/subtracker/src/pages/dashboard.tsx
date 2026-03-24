import * as React from "react";
import { Link } from "wouter";
import { useGetProjects, useCreateProject, getGetProjectsQueryKey, useGetMe, useGetGcDisputedInvoices, useGetContacts, useInviteSubcontractor, useInviteContactToProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { PaywallModal } from "@/components/paywall-modal";
import { format } from "date-fns";
import { Plus, Briefcase, Building2, ChevronRight, FileSignature, DollarSign, AlertTriangle, MapPin, CalendarDays, ShieldAlert, Receipt, ExternalLink, CreditCard, Archive, ArchiveRestore, Search, UserPlus, PartyPopper, KeyRound, Check, Copy, CheckCircle2, Clock, Banknote, Shield, PenLine, FileWarning, ListChecks, Mail } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { getSubscriptionStatus } from "@/lib/stripe";
import { useQuery } from "@tanstack/react-query";
import { TrialBanner } from "@/components/trial-banner";
import toast from "react-hot-toast";

// ── Action Required types ──────────────────────────────────────────────────────
type ActionItem = {
  id: string;
  type: string;
  urgency: "URGENT" | "PENDING" | "UPCOMING";
  projectId: string;
  projectName: string;
  subcontractId: string;
  subCompanyName: string;
  description: string;
  amount?: number;
  overAmount?: number;
  expiresAt?: string;
  href: string;
};

const URGENCY_CONFIG = {
  URGENT: {
    label: "Urgent",
    headerBg: "bg-red-50 dark:bg-red-950/20",
    headerBorder: "border-red-200 dark:border-red-800",
    headerText: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    rowHover: "hover:bg-red-50/60 dark:hover:bg-red-950/10",
    pillBg: "bg-red-100 dark:bg-red-900/40",
    pillText: "text-red-700 dark:text-red-400",
  },
  PENDING: {
    label: "Pending",
    headerBg: "bg-amber-50 dark:bg-amber-950/20",
    headerBorder: "border-amber-200 dark:border-amber-800",
    headerText: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    rowHover: "hover:bg-amber-50/60 dark:hover:bg-amber-950/10",
    pillBg: "bg-amber-100 dark:bg-amber-900/40",
    pillText: "text-amber-700 dark:text-amber-400",
  },
  UPCOMING: {
    label: "Upcoming",
    headerBg: "bg-blue-50 dark:bg-blue-950/20",
    headerBorder: "border-blue-200 dark:border-blue-800",
    headerText: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
    rowHover: "hover:bg-blue-50/60 dark:hover:bg-blue-950/10",
    pillBg: "bg-blue-100 dark:bg-blue-900/40",
    pillText: "text-blue-700 dark:text-blue-400",
  },
} as const;

function getItemIcon(type: string) {
  switch (type) {
    case "FLAGGED_INVOICE":    return <FileWarning className="h-4 w-4 shrink-0" />;
    case "PENDING_INVOICE":    return <Receipt className="h-4 w-4 shrink-0" />;
    case "DISPUTED_PAYMENT":   return <ShieldAlert className="h-4 w-4 shrink-0" />;
    case "PAST_DUE_INVOICE":   return <Banknote className="h-4 w-4 shrink-0" />;
    case "UNSIGNED_CONTRACT":  return <PenLine className="h-4 w-4 shrink-0" />;
    case "INSURANCE_EXPIRING": return <Shield className="h-4 w-4 shrink-0" />;
    case "PROJECTED_OVERRUN":  return <AlertTriangle className="h-4 w-4 shrink-0" />;
    default:                   return <AlertTriangle className="h-4 w-4 shrink-0" />;
  }
}

function ActionRequired({ items, isLoading }: { items: ActionItem[]; isLoading: boolean }) {
  const totalCount = items.length;

  if (isLoading) {
    return (
      <div className="mb-6 rounded-2xl border border-border bg-card animate-pulse h-24" />
    );
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Action Required
        </h2>
        {totalCount > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold leading-none">
            {totalCount}
          </span>
        ) : null}
      </div>

      {totalCount === 0 ? (
        /* Zero state */
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            All caught up — nothing needs your attention right now.
          </p>
        </div>
      ) : (
        /* Grouped items */
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {(["URGENT", "PENDING", "UPCOMING"] as const).map((urgency) => {
            const group = items.filter(i => i.urgency === urgency);
            if (group.length === 0) return null;
            const cfg = URGENCY_CONFIG[urgency];
            return (
              <div key={urgency}>
                {/* Group sub-header */}
                <div className={cn("flex items-center gap-2 px-4 py-2 border-b", cfg.headerBg, cfg.headerBorder)}>
                  <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
                  <span className={cn("text-xs font-bold uppercase tracking-widest", cfg.headerText)}>
                    {cfg.label} — {group.length} item{group.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* Items */}
                {group.map((item, idx) => (
                  <Link key={item.id} href={item.href}>
                    <div className={cn(
                      "flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors",
                      cfg.rowHover,
                      idx < group.length - 1 && "border-b border-border/50"
                    )}>
                      {/* Icon pill */}
                      <div className={cn("mt-0.5 rounded-lg p-1.5 shrink-0", cfg.pillBg)}>
                        <span className={cfg.pillText}>{getItemIcon(item.type)}</span>
                      </div>

                      {/* Text content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                          {item.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                          <span className="text-xs text-muted-foreground">{item.projectName}</span>
                          {item.amount !== undefined && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs font-mono font-semibold text-foreground">
                                {formatCurrency(item.amount)}
                              </span>
                            </>
                          )}
                          {item.overAmount !== undefined && item.overAmount > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400">
                                +{formatCurrency(item.overAmount)} over
                              </span>
                            </>
                          )}
                          {item.expiresAt && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                Expires {format(new Date(item.expiresAt), "MMM d, yyyy")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: user } = useGetMe();
  const { data: projects, isLoading } = useGetProjects();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const isGC = user?.role === "GC";
  const gcTeamRole = (user as any)?.gcTeamRole as string | null | undefined;
  const isOwner = isGC && (gcTeamRole === "owner" || gcTeamRole == null);
  const { data: gcDisputedInvoices = [] } = useGetGcDisputedInvoices({ query: { enabled: isGC } });

  const BASE_DASH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  type CompliancePendingItem = { itemId: string; title: string; projectId: string; projectName: string; subcontractId: string };
  const { data: pendingComplianceItems = [] } = useQuery<CompliancePendingItem[]>({
    queryKey: ["compliance-pending-sub"],
    queryFn: async () => {
      const res = await fetch(`${BASE_DASH}/api/subcontracts/compliance-pending`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isGC,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: subPendingCOProjects = [] } = useQuery<string[]>({
    queryKey: ["sub-pending-co-projects"],
    queryFn: async () => {
      const res = await fetch(`${BASE_DASH}/api/projects/sub/pending-co-projects`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isGC,
    refetchInterval: 60_000,
  });

  usePageTitle("Projects");

  const onboardingKey = user ? `onboarding-dismissed-${user.id}` : null;
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  React.useEffect(() => {
    if (onboardingKey && !localStorage.getItem(onboardingKey) && !isLoading && projects !== undefined) {
      if (projects.length === 0) setShowOnboarding(true);
    }
  }, [onboardingKey, isLoading, projects]);

  const dismissOnboarding = () => {
    if (onboardingKey) localStorage.setItem(onboardingKey, "1");
    setShowOnboarding(false);
  };

  const { data: subStatus } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getSubscriptionStatus,
    enabled: isOwner,
  });

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const { data: unsignedWaivers } = useQuery<{ count: number }>({
    queryKey: ["unsigned-lien-waivers"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/gc/unsigned-lien-waivers`, { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: isGC,
    refetchInterval: 60_000,
  });

  const { data: insuranceAlerts } = useQuery<{ expired: number; expiringSoon: number }>({
    queryKey: ["insurance-alerts"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/gc/insurance-alerts`, { credentials: "include" });
      if (!res.ok) return { expired: 0, expiringSoon: 0 };
      return res.json();
    },
    enabled: isGC,
    refetchInterval: 60_000,
  });

  const { data: actionItems = [], isLoading: actionItemsLoading } = useQuery<ActionItem[]>({
    queryKey: ["gc-action-items"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/gc/action-items`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isGC,
    refetchInterval: 30_000,
  });

  const [archiveSearch, setArchiveSearch] = React.useState("");
  const [unarchivingId, setUnarchivingId] = React.useState<string | null>(null);

  // Add Subcontractor from dashboard
  const { data: contacts = [] } = useGetContacts({ query: { enabled: isGC } });
  const inviteSub = useInviteSubcontractor();
  const inviteContactToProject = useInviteContactToProject();
  const [isAddSubOpen, setIsAddSubOpen] = React.useState(false);
  const [addSubProjectId, setAddSubProjectId] = React.useState("");
  const [addSubTab, setAddSubTab] = React.useState<"contact" | "new">("contact");
  const [addSubContactSearch, setAddSubContactSearch] = React.useState("");
  const [addSubEmail, setAddSubEmail] = React.useState("");
  const [addSubCompanyName, setAddSubCompanyName] = React.useState("");
  const [addSubStep, setAddSubStep] = React.useState<"project" | "sub" | "contract">("project");
  const [addSubSelected, setAddSubSelected] = React.useState<{ subId?: string; email?: string; companyName: string } | null>(null);
  const [addSubAmount, setAddSubAmount] = React.useState("");
  const [addSubTrade, setAddSubTrade] = React.useState("");
  const [addSubRetention, setAddSubRetention] = React.useState("10");
  const [addSubLoading, setAddSubLoading] = React.useState(false);
  const [addSubSuccess, setAddSubSuccess] = React.useState<{ companyName: string; projectName: string } | null>(null);
  const [addSubCopied, setAddSubCopied] = React.useState(false);
  const [addSubNewResult, setAddSubNewResult] = React.useState<{ email: string; temporaryPassword: string } | null>(null);

  const ADD_SUB_TRADE_CATEGORIES = ["General","Electrical","Plumbing","HVAC","Framing","Drywall","Roofing","Flooring","Concrete","Masonry","Painting","Landscaping","Fire Protection","Elevators","Security","Other"];

  const activeProjects = (projects ?? []).filter((p: any) => p.status === "BIDDING" || p.status === "CONSTRUCTION");
  const selectedProject = activeProjects.find((p: any) => p.id === addSubProjectId) as any;
  const selectedProjectIsConstruction = selectedProject?.status === "CONSTRUCTION";

  const handleAddSubClose = () => {
    setIsAddSubOpen(false);
    setAddSubProjectId("");
    setAddSubTab("contact");
    setAddSubContactSearch("");
    setAddSubEmail("");
    setAddSubCompanyName("");
    setAddSubStep("project");
    setAddSubSelected(null);
    setAddSubAmount("");
    setAddSubTrade("");
    setAddSubRetention("10");
    setAddSubLoading(false);
    setAddSubSuccess(null);
    setAddSubCopied(false);
    setAddSubNewResult(null);
  };

  const handleAddSubContactSelect = async (subId: string, companyName: string) => {
    if (selectedProjectIsConstruction) {
      setAddSubSelected({ subId, companyName });
      setAddSubStep("contract");
    } else {
      setAddSubLoading(true);
      try {
        await inviteContactToProject.mutateAsync({ subId, projectId: addSubProjectId });
        queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
        setAddSubSuccess({ companyName, projectName: selectedProject?.name ?? "" });
      } catch (err: any) {
        toast.error(err?.data?.error ?? "Failed to add to project");
      } finally {
        setAddSubLoading(false);
      }
    }
  };

  const handleAddSubNewNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSubEmail.trim() || !addSubCompanyName.trim()) return;
    if (selectedProjectIsConstruction) {
      setAddSubSelected({ email: addSubEmail.trim(), companyName: addSubCompanyName.trim() });
      setAddSubStep("contract");
    } else {
      handleAddSubInviteNew();
    }
  };

  const handleAddSubInviteNew = async () => {
    setAddSubLoading(true);
    try {
      const result = await inviteSub.mutateAsync({ projectId: addSubProjectId, data: { email: addSubEmail, companyName: addSubCompanyName } });
      queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
      if ((result as any).isNewUser && (result as any).temporaryPassword) {
        setAddSubNewResult({ email: addSubEmail, temporaryPassword: (result as any).temporaryPassword });
      } else {
        setAddSubSuccess({ companyName: addSubCompanyName, projectName: selectedProject?.name ?? "" });
      }
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Failed to invite subcontractor");
    } finally {
      setAddSubLoading(false);
    }
  };

  const handleAddSubDirectContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSubSelected) return;
    const amount = parseFloat(addSubAmount.replace(/[$,]/g, ""));
    if (isNaN(amount) || amount <= 0) return toast.error("Enter a valid contract amount");
    setAddSubLoading(true);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${BASE}/api/projects/${addSubProjectId}/subcontracts/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subId: addSubSelected.subId,
          email: addSubSelected.email,
          companyName: addSubSelected.companyName,
          baseContractAmount: amount,
          tradeCategory: addSubTrade.trim() || undefined,
          retentionPercentage: Number(addSubRetention) || 10,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 402 || errData.error === "PLAN_LIMIT_REACHED") {
          handleAddSubClose();
          setPaywallMessage(errData.message);
          setPaywallSuggestedPlan(errData.nextPlan?.name);
          setIsPaywallOpen(true);
          return;
        }
        throw new Error(errData.message || errData.error || "Failed to create subcontract");
      }
      queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
      setAddSubSuccess({ companyName: addSubSelected.companyName, projectName: selectedProject?.name ?? "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create subcontract");
    } finally {
      setAddSubLoading(false);
    }
  };

  const { data: archivedProjects = [], refetch: refetchArchived } = useQuery({
    queryKey: ["archived-projects", archiveSearch],
    queryFn: async () => {
      const url = archiveSearch
        ? `${BASE}/api/projects/archived?search=${encodeURIComponent(archiveSearch)}`
        : `${BASE}/api/projects/archived`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isGC,
  });

  const handleUnarchive = async (projectId: string) => {
    setUnarchivingId(projectId);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/unarchive`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to restore project");
      toast.success("Project restored to dashboard!");
      refetchArchived();
      queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
    } catch {
      toast.error("Failed to restore project");
    } finally {
      setUnarchivingId(null);
    }
  };

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = React.useState(false);
  const [paywallMessage, setPaywallMessage] = React.useState<string | undefined>();
  const [paywallSuggestedPlan, setPaywallSuggestedPlan] = React.useState<string | undefined>();
  const [newName, setNewName] = React.useState("");
  const [newAddress, setNewAddress] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newStartDate, setNewStartDate] = React.useState("");
  const [newLaborType, setNewLaborType] = React.useState<"non-union" | "union">("non-union");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createProject.mutateAsync({ data: {
        name: newName.trim(),
        address: newAddress.trim() || undefined,
        description: newDescription.trim() || undefined,
        estimatedStartDate: newStartDate || undefined,
        laborType: newLaborType,
      } as any});
      toast.success("Project created!");
      queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
      setIsCreateOpen(false);
      setNewName("");
      setNewAddress("");
      setNewDescription("");
      setNewStartDate("");
      setNewLaborType("non-union");
    } catch (err: any) {
      const errCode = err?.data?.error;
      if (err?.status === 402 || errCode === "SUBSCRIPTION_REQUIRED" || errCode === "PLAN_LIMIT_REACHED") {
        setIsCreateOpen(false);
        if (errCode === "PLAN_LIMIT_REACHED") {
          setPaywallMessage(err?.data?.message);
          setPaywallSuggestedPlan(err?.data?.nextPlan?.name);
        } else {
          setPaywallMessage(undefined);
          setPaywallSuggestedPlan(undefined);
        }
        setIsPaywallOpen(true);
      } else {
        toast.error("Failed to create project");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "BIDDING": return "default";
      case "CONSTRUCTION": return "success";
      case "COMPLETE": return "secondary";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "CONSTRUCTION": return "In Construction";
      case "COMPLETE": return "Complete";
      default: return status;
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Manage your active bids and subcontracts</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          {isGC && gcDisputedInvoices.length > 0 && (
            <Badge variant="destructive" className="gap-1.5 text-sm px-3 py-1.5 animate-pulse">
              <ShieldAlert className="h-4 w-4" />
              {gcDisputedInvoices.length} Disputed Payment{gcDisputedInvoices.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {isGC && (unsignedWaivers?.count ?? 0) > 0 && (
            <Badge variant="warning" className="gap-1.5 text-sm px-3 py-1.5">
              <AlertTriangle className="h-4 w-4" />
              {unsignedWaivers!.count} Unsigned Lien Waiver{unsignedWaivers!.count !== 1 ? "s" : ""}
            </Badge>
          )}
          {isGC && (insuranceAlerts?.expired ?? 0) > 0 && (
            <Badge variant="destructive" className="gap-1.5 text-sm px-3 py-1.5 animate-pulse">
              <ShieldAlert className="h-4 w-4" />
              {insuranceAlerts!.expired} Expired Insurance
            </Badge>
          )}
          {isGC && (insuranceAlerts?.expired ?? 0) === 0 && (insuranceAlerts?.expiringSoon ?? 0) > 0 && (
            <Badge variant="warning" className="gap-1.5 text-sm px-3 py-1.5">
              <ShieldAlert className="h-4 w-4" />
              {insuranceAlerts!.expiringSoon} Insurance Expiring Soon
            </Badge>
          )}
          {isGC && activeProjects.length > 0 && (
            <Button variant="outline" onClick={() => setIsAddSubOpen(true)} className="gap-2 min-h-[44px]">
              <UserPlus className="h-5 w-5" />
              <span className="hidden sm:inline">Invite Sub to Bid</span>
              <span className="sm:hidden">Invite Sub</span>
            </Button>
          )}
          {isOwner && (
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2 min-h-[44px]">
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      {/* Trial countdown banner — only when trial is active and no paid plan */}
      {isGC && subStatus?.trialActive && !subStatus?.planName && (
        <TrialBanner
          daysLeft={subStatus.trialDaysLeft}
          trialEndsAt={subStatus.trialEndsAt ?? null}
        />
      )}

      {/* Annual plan banner */}
      {isGC && subStatus?.billingInterval === "year" && subStatus?.annualRenewsAt && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-green-800 dark:text-green-300 font-medium">
            Annual plan active — renews on {new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(subStatus.annualRenewsAt))}.
          </span>
          <a href="/billing" className="ml-auto text-xs font-semibold text-green-700 hover:underline shrink-0">Manage →</a>
        </div>
      )}

      {/* Active subcontracts usage indicator */}
      {isGC && subStatus?.subscribed && subStatus?.planName && subStatus.planName !== "Demo" && subStatus?.limit !== null && (
        <div className={cn(
          "mb-4 rounded-xl border p-3 flex items-center gap-3 text-sm",
          (subStatus.activeCount ?? 0) >= subStatus.limit
            ? "border-red-300 bg-red-50 dark:bg-red-950/20"
            : (subStatus.activeCount ?? 0) >= subStatus.limit - 5
            ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20"
            : "border-border bg-secondary/30"
        )}>
          <div className="flex-1 min-w-0">
            <div className={cn(
              "font-semibold text-xs",
              (subStatus.activeCount ?? 0) >= subStatus.limit ? "text-red-700 dark:text-red-400"
              : (subStatus.activeCount ?? 0) >= subStatus.limit - 5 ? "text-yellow-700 dark:text-yellow-400"
              : "text-foreground"
            )}>
              Active Subcontracts: {subStatus.activeCount ?? 0} of {subStatus.limit}
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
              <div
                className={cn("h-1.5 rounded-full transition-all", (subStatus.activeCount ?? 0) >= subStatus.limit ? "bg-red-500" : (subStatus.activeCount ?? 0) >= subStatus.limit - 5 ? "bg-yellow-500" : "bg-primary")}
                style={{ width: `${Math.min(100, ((subStatus.activeCount ?? 0) / subStatus.limit) * 100)}%` }}
              />
            </div>
          </div>
          {(subStatus.activeCount ?? 0) >= subStatus.limit && (
            <a href="/billing" className="text-xs font-semibold text-red-700 hover:underline shrink-0">Upgrade →</a>
          )}
          {(subStatus.activeCount ?? 0) < subStatus.limit && (subStatus.activeCount ?? 0) >= subStatus.limit - 5 && (
            <a href="/billing" className="text-xs font-semibold text-yellow-700 hover:underline shrink-0">Upgrade →</a>
          )}
        </div>
      )}

      {/* Payment failure banner */}
      {isGC && subStatus?.isPastDue && (
        <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
          <CreditCard className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-red-800 dark:text-red-300 text-sm">Payment failed — please update your billing info to continue</div>
            <div className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              You have a 3-day grace period before new subcontract creation is locked.
            </div>
          </div>
          <a href="/billing" className="text-xs font-semibold text-red-700 hover:underline shrink-0">Update billing →</a>
        </div>
      )}

      {showOnboarding && user && (
        <OnboardingBanner role={user.role as "GC" | "SUB"} onDismiss={dismissOnboarding} />
      )}

      {/* ── GC: Action Required Dashboard ─────────────────────────────────── */}
      {isGC && (
        <ActionRequired items={actionItems} isLoading={actionItemsLoading} />
      )}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse h-48 bg-card/50" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-border/50 shadow-sm">
          <Briefcase className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-bold mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {isGC
              ? "Create your first project to start inviting subcontractors."
              : "You haven't been invited to any projects yet."}
          </p>
          {isGC && (
            <Button onClick={() => setIsCreateOpen(true)}>Create Project</Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map(project => {
            const fs = (project as any).financialSummary as {
              subcontractCount: number;
              totalApprovedAmount: number;
              totalInvoiced: number;
              hasFlaggedInvoices: boolean;
            } | undefined;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer group">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-primary/10 p-3 rounded-xl text-primary">
                        <Briefcase className="h-6 w-6" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isGC && fs?.hasFlaggedInvoices && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" /> Flagged
                          </Badge>
                        )}
                        {!isGC && subPendingCOProjects.includes(project.id) && (
                          <Badge className="gap-1 text-xs bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700 hover:bg-amber-100">
                            <AlertTriangle className="h-3 w-3" /> New Change Order
                          </Badge>
                        )}
                        <Badge variant={getStatusColor(project.status) as any}>
                          {getStatusLabel(project.status)}
                        </Badge>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold font-display mb-1 group-hover:text-primary transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <div className="space-y-1 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">{project.gc.companyName}</span>
                      </div>
                      {(project as any).address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span className="truncate">{(project as any).address}</span>
                        </div>
                      )}
                      {(project as any).estimatedStartDate && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4 shrink-0" />
                          <span>Start: {format(new Date((project as any).estimatedStartDate), "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>

                    {isGC && fs && (
                      <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-muted/40 rounded-xl border border-border/50">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            <FileSignature className="h-3 w-3" />
                            <span className="text-xs">Active Subs</span>
                          </div>
                          <p className="text-lg font-bold font-mono">{fs.subcontractCount}</p>
                        </div>
                        <div className="text-center border-l border-border/50">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            <DollarSign className="h-3 w-3" />
                            <span className="text-xs">Total Value</span>
                          </div>
                          <p className="text-sm font-bold font-mono text-foreground leading-tight">
                            {formatCurrency(fs.totalApprovedAmount)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(project.createdAt), "MMM d, yyyy")}
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* GC: Disputed Payments Section */}
      {isGC && gcDisputedInvoices.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-red-100 dark:bg-red-900/40 rounded-xl p-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-red-700 dark:text-red-400">Disputed Payments</h2>
              <p className="text-sm text-muted-foreground">Subcontractors have disputed the following payments — please follow up to resolve.</p>
            </div>
          </div>
          <div className="space-y-3">
            {gcDisputedInvoices.map(inv => (
              <div key={inv.invoiceId} className="rounded-2xl border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">Invoice #{inv.invoiceNumber}</span>
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <ShieldAlert className="h-3 w-3" /> Payment Disputed
                      </Badge>
                    </div>
                    <div className="font-mono text-xl font-bold text-foreground">{formatCurrency(inv.amount)}</div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{inv.projectName}</span>
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{inv.subCompanyName}</span>
                      <span className="flex items-center gap-1"><Receipt className="h-3.5 w-3.5" />{format(new Date(inv.updatedAt), "MMM d, yyyy")}</span>
                    </div>
                    {inv.disputeReason && (
                      <div className="mt-2 flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-100/60 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-xs uppercase tracking-wide mb-0.5">Dispute Reason</span>
                          {inv.disputeReason}
                        </div>
                      </div>
                    )}
                  </div>
                  <Link href={`/subcontracts/${inv.subcontractId}`}>
                    <Button size="sm" variant="destructive" className="gap-1.5 min-h-[44px] shrink-0">
                      <ExternalLink className="h-4 w-4" /> View Subcontract
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB: Compliance Pending Section */}
      {!isGC && pendingComplianceItems.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-orange-100 dark:bg-orange-900/40 rounded-xl p-2">
              <ListChecks className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-orange-700 dark:text-orange-400">Compliance Required</h2>
              <p className="text-sm text-muted-foreground">Complete these required items before you can submit invoices on the following projects.</p>
            </div>
          </div>
          <div className="space-y-3">
            {Object.entries(
              pendingComplianceItems.reduce((acc, item) => {
                const key = item.projectId;
                if (!acc[key]) acc[key] = { projectName: item.projectName, subcontractId: item.subcontractId, items: [] };
                acc[key].items.push(item);
                return acc;
              }, {} as Record<string, { projectName: string; subcontractId: string; items: CompliancePendingItem[] }>)
            ).map(([projectId, group]) => (
              <div key={projectId} className="rounded-2xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-orange-600 shrink-0" />
                      <span className="font-semibold text-foreground truncate">{group.projectName}</span>
                      <span className="text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-700">
                        {group.items.length} pending
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {group.items.map(item => (
                        <li key={item.itemId} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href={`/subcontracts/${group.subcontractId}`}>
                    <Button size="sm" variant="outline" className="gap-1.5 min-h-[44px] shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100">
                      <ExternalLink className="h-4 w-4" /> Complete Now
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ARCHIVED PROJECTS SECTION — GC only, always visible */}
      {isGC && (
        <div className="mt-12 pt-8 border-t border-border/60">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="bg-muted rounded-xl p-2.5">
                <Archive className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-display text-foreground">Archived Projects</h2>
                <p className="text-xs text-muted-foreground">Completed projects stored for reference — read only</p>
              </div>
            </div>
            {(archivedProjects as any[]).length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {(archivedProjects as any[]).length} project{(archivedProjects as any[]).length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search archived projects by name or address..."
                value={archiveSearch}
                onChange={e => setArchiveSearch(e.target.value)}
              />
            </div>

            {(archivedProjects as any[]).length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border/60">
                <Archive className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {archiveSearch ? "No archived projects match your search." : "No archived projects yet."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Mark a project complete, then archive it to store it here.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(archivedProjects as any[]).map(project => {
                  const summary = project.archivedSummary as { totalContractValue: number; totalPaid: number; subcontractCount: number } | undefined;
                  return (
                    <div key={project.id} className="bg-card rounded-2xl border border-border/50 p-5 flex flex-col gap-3 opacity-85 hover:opacity-100 transition-opacity">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Link href={`/projects/${project.id}`}>
                            <h3 className="font-bold text-base text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-1">
                              {project.name}
                            </h3>
                          </Link>
                          {project.address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 shrink-0" /> {project.address}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                          <Archive className="h-2.5 w-2.5" /> Archived
                        </Badge>
                      </div>

                      {/* Final scoreboard summary */}
                      {summary && (
                        <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-xl border border-border/50 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Contract</p>
                            <p className="text-xs font-bold font-mono text-foreground">{formatCurrency(summary.totalContractValue)}</p>
                          </div>
                          <div className="border-x border-border/50">
                            <p className="text-xs text-muted-foreground mb-0.5">Paid</p>
                            <p className="text-xs font-bold font-mono text-green-600">{formatCurrency(summary.totalPaid)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Subs</p>
                            <p className="text-xs font-bold font-mono text-foreground">{summary.subcontractCount}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Archived {format(new Date(project.archivedAt), "MMM d, yyyy")}
                        </span>
                        <button
                          onClick={() => handleUnarchive(project.id)}
                          disabled={unarchivingId === project.id}
                          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                        >
                          {unarchivingId === project.id ? "Restoring…" : <><ArchiveRestore className="h-3 w-3" /> Restore</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <PaywallModal
        open={isPaywallOpen}
        onOpenChange={setIsPaywallOpen}
        limitMessage={paywallMessage}
        suggestedPlanName={paywallSuggestedPlan}
      />

      {/* Add Subcontractor from Dashboard */}
      <Dialog
        open={isAddSubOpen}
        onOpenChange={(open) => { if (!open) handleAddSubClose(); }}
        title={
          addSubSuccess ? (selectedProjectIsConstruction ? "Subcontractor Added!" : "Invitation Sent!") :
          addSubNewResult ? "Invitation Sent!" :
          addSubStep === "contract" ? `Direct Award — No Bid Required` :
          addSubStep === "sub" ? (selectedProjectIsConstruction ? `Add Sub to ${selectedProject?.name}` : `Invite Sub to Bid — ${selectedProject?.name}`) :
          "Invite Sub to Bid"
        }
        description={
          addSubStep === "project" ? "Choose which project to invite the subcontractor to." :
          addSubStep === "contract" ? `${selectedProject?.name} · Direct Award — enter the agreed contract amount.` :
          selectedProjectIsConstruction ? "Direct Award — No Bid Required. Pick a sub to add mid-construction. You'll enter the agreed amount next." :
          undefined
        }
      >
        {/* ─── SUCCESS ─── */}
        {addSubSuccess ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
              {selectedProjectIsConstruction ? (
                <PartyPopper className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              ) : (
                <Mail className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5">
                {selectedProjectIsConstruction ? (
                  <>
                    <p className="font-semibold text-green-800 dark:text-green-300">{addSubSuccess.companyName} added to {addSubSuccess.projectName}</p>
                    <p className="text-sm text-green-700 dark:text-green-400">Subcontract created — they can now submit invoices.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-green-800 dark:text-green-300">
                      An invitation has been sent to <span className="font-bold">{addSubSuccess.companyName}</span>.
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-400">They will receive a magic link to view your plans and submit their bid.</p>
                    <p className="text-sm text-green-700 dark:text-green-400">You will be notified when their bid is received.</p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-1 pt-2 border-t border-green-200 dark:border-green-800">There is no amount to enter at this stage — the sub submits their own bid.</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 flex-col-reverse sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => { setAddSubSuccess(null); setAddSubStep("project"); setAddSubProjectId(""); setAddSubTab("contact"); setAddSubContactSearch(""); setAddSubEmail(""); setAddSubCompanyName(""); setAddSubSelected(null); setAddSubAmount(""); }} className="min-h-[44px]">
                {selectedProjectIsConstruction ? "Add Another" : "Invite Another"}
              </Button>
              <Button onClick={handleAddSubClose} className="min-h-[44px]">Done</Button>
            </div>
          </div>

        /* ─── NEW USER CREDENTIALS (new account created) ─── */
        ) : addSubNewResult ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                <Mail className="h-4 w-4" />
                Invitation sent — new account created for {selectedProject?.name}
              </div>
              <p className="text-sm text-green-700 dark:text-green-400">They will receive a magic link to view your plans and submit their bid. You will be notified when their bid is received.</p>
              <p className="text-xs text-green-600 dark:text-green-500">There is no amount to enter at this stage — the sub submits their own bid.</p>
              <div className="border-t border-green-200 dark:border-green-800 pt-3 space-y-2 text-sm">
                <p className="text-xs font-semibold text-green-800 dark:text-green-300">Share these credentials if they can't find the email:</p>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Login email:</span>
                  <span className="font-mono font-medium">{addSubNewResult.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Temp password:</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-base bg-background border border-border px-2 py-0.5 rounded-md">
                      {addSubNewResult.temporaryPassword}
                    </code>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      navigator.clipboard.writeText(addSubNewResult!.temporaryPassword);
                      setAddSubCopied(true);
                      setTimeout(() => setAddSubCopied(false), 2000);
                    }}>
                      {addSubCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAddSubClose} className="min-h-[44px]">Done</Button>
            </div>
          </div>

        /* ─── STEP 1: pick project ─── */
        ) : addSubStep === "project" ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">Select Project</label>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activeProjects.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setAddSubProjectId(p.id); setAddSubStep("sub"); }}
                    className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left min-h-[56px]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{(p as any).address || "No address"}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${p.status === "CONSTRUCTION" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"}`}>
                      {p.status === "CONSTRUCTION" ? "In Construction" : "Bidding"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={handleAddSubClose} className="min-h-[44px]">Cancel</Button>
            </div>
          </div>

        /* ─── STEP 2: contract details (construction only) ─── */
        ) : addSubStep === "contract" ? (
          <form onSubmit={handleAddSubDirectContract} className="mt-4 space-y-4">
            <div className="rounded-xl bg-muted/40 border border-border p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {addSubSelected?.companyName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{addSubSelected?.companyName}</p>
                <p className="text-xs text-muted-foreground">Will be added to {selectedProject?.name}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Contract Amount *</label>
              <Input
                type="text"
                inputMode="decimal"
                required
                placeholder="$85,000"
                value={addSubAmount}
                onChange={e => setAddSubAmount(e.target.value)}
                className="text-lg font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1 block">Trade Category</label>
                <select
                  value={addSubTrade}
                  onChange={e => setAddSubTrade(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="">Select…</option>
                  {ADD_SUB_TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Retention %</label>
                <Input
                  type="number"
                  min="0"
                  max="15"
                  step="0.5"
                  value={addSubRetention}
                  onChange={e => setAddSubRetention(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
              <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setAddSubStep("sub")}>← Back</Button>
              <Button type="submit" isLoading={addSubLoading} className="min-h-[44px] px-6">Create Subcontract</Button>
            </div>
          </form>

        /* ─── STEP 2: select sub (contact book or new) ─── */
        ) : (
          <div className="mt-4">
            {selectedProjectIsConstruction && (
              <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 font-medium">
                In Construction — you'll enter the contract amount after selecting.
              </div>
            )}
            <div className="flex rounded-xl border border-border overflow-hidden mb-4">
              <button type="button" className={`flex-1 py-2.5 text-sm font-medium transition-colors ${addSubTab === "contact" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`} onClick={() => setAddSubTab("contact")}>
                From Contact Book
              </button>
              <button type="button" className={`flex-1 py-2.5 text-sm font-medium transition-colors ${addSubTab === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`} onClick={() => setAddSubTab("new")}>
                Invite New Sub
              </button>
            </div>

            {addSubTab === "contact" ? (
              <div className="space-y-3">
                <Input placeholder="Search contacts…" value={addSubContactSearch} onChange={e => setAddSubContactSearch(e.target.value)} />
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {contacts.filter((c: any) =>
                    c.sub.companyName.toLowerCase().includes(addSubContactSearch.toLowerCase()) ||
                    c.sub.email.toLowerCase().includes(addSubContactSearch.toLowerCase())
                  ).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {contacts.length === 0 ? "Contact book is empty. Use 'Invite New Sub' instead." : "No contacts match your search."}
                    </p>
                  ) : contacts
                    .filter((c: any) =>
                      c.sub.companyName.toLowerCase().includes(addSubContactSearch.toLowerCase()) ||
                      c.sub.email.toLowerCase().includes(addSubContactSearch.toLowerCase())
                    )
                    .map((contact: any) => {
                      const alreadyMember = selectedProject?.members?.some((m: any) => m.id === contact.subId);
                      const hasSubcontract = selectedProjectIsConstruction && selectedProject?.subcontracts?.some((s: any) => s.subId === contact.subId);
                      const disabled = selectedProjectIsConstruction ? hasSubcontract : alreadyMember;
                      return (
                        <div key={contact.subId} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                            {contact.sub.companyName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{contact.sub.companyName}</p>
                            <p className="text-xs text-muted-foreground truncate">{contact.subProfile?.trade ?? contact.sub.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={disabled ? "outline" : "default"}
                            disabled={disabled || addSubLoading}
                            onClick={() => !disabled && handleAddSubContactSelect(contact.subId, contact.sub.companyName)}
                          >
                            {disabled ? (selectedProjectIsConstruction ? "Active" : "Invited") : selectedProjectIsConstruction ? "Select →" : "Invite to Bid"}
                          </Button>
                        </div>
                      );
                    })
                  }
                </div>
                <div className="flex justify-between pt-1">
                  <Button type="button" variant="ghost" onClick={() => setAddSubStep("project")}>← Back</Button>
                  <Button type="button" variant="ghost" onClick={handleAddSubClose}>Cancel</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddSubNewNext} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Email Address</label>
                  <Input type="email" required placeholder="sub@example.com" value={addSubEmail} onChange={e => setAddSubEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Company Name</label>
                  <Input type="text" required placeholder="ABC Electric LLC" value={addSubCompanyName} onChange={e => setAddSubCompanyName(e.target.value)} />
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
                  <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setAddSubStep("project")}>← Back</Button>
                  <Button type="submit" isLoading={addSubLoading} className="min-h-[44px]">
                    {selectedProjectIsConstruction ? "Next — Enter Contract Amount →" : "Send Invitation"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen} title="Create New Project" description="Add details about your project. Only the name is required.">
        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-semibold mb-1 block">Project Name *</label>
            <Input
              autoFocus
              required
              placeholder="e.g. Downtown Office Renovation"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Full Address</label>
            <Input
              placeholder="e.g. 123 Main St, Chicago, IL 60601"
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Project Description</label>
            <textarea
              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              rows={3}
              placeholder="Brief overview of the project scope and objectives..."
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Estimated Start Date</label>
            <Input
              type="date"
              value={newStartDate}
              onChange={e => setNewStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-2 block">Labor Type</label>
            <div className="flex rounded-xl border border-input overflow-hidden">
              <button
                type="button"
                onClick={() => setNewLaborType("non-union")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-semibold transition-colors",
                  newLaborType === "non-union"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Non-Union Open Shop
              </button>
              <button
                type="button"
                onClick={() => setNewLaborType("union")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-semibold border-l border-input transition-colors",
                  newLaborType === "union"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Union Prevailing Wage
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Used for AI bid range analysis. You can change this in project settings later.</p>
          </div>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Tip:</span> After creating the project, add your insurance certificate and contractor license in Project Settings — they will automatically appear on every subcontract and on your subs' dashboards. You only need to enter your credentials once per project.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="min-h-[44px]">Cancel</Button>
            <Button type="submit" isLoading={createProject.isPending} className="min-h-[44px]">Create Project</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
