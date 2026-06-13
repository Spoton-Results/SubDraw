import * as React from "react";
import { Link, useLocation } from "wouter";
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
import { Plus, Briefcase, Building2, ChevronRight, FileSignature, DollarSign, AlertTriangle, MapPin, CalendarDays, ShieldAlert, Receipt, ExternalLink, CreditCard, Archive, ArchiveRestore, Search, UserPlus, KeyRound, Check, Copy, CheckCircle2, Clock, Banknote, Shield, PenLine, FileWarning, ListChecks, Mail, Inbox, MessageSquare, X, FilePlus2, GitPullRequest, Upload } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { getSubscriptionStatus } from "@/lib/stripe";
import { useQuery } from "@tanstack/react-query";
import { TrialBanner } from "@/components/trial-banner";
import toast from "react-hot-toast";
import { DemoGateModal, isDemoGatePassed } from "@/components/demo-gate-modal";
import { useUpload } from "@workspace/object-storage-web";

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
    case "OVERDUE_SUBMITTAL":  return <Inbox className="h-4 w-4 shrink-0" />;
    default:                   return <AlertTriangle className="h-4 w-4 shrink-0" />;
  }
}

function ActionRequired({ items, isLoading, onFlaggedInvoiceClick }: {
  items: ActionItem[];
  isLoading: boolean;
  onFlaggedInvoiceClick?: (href: string) => void;
}) {
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
                {group.map((item, idx) => {
                  const isFlaggedInvoice = item.type === "FLAGGED_INVOICE";
                  const interceptClick = isFlaggedInvoice && !!onFlaggedInvoiceClick;
                  const innerEl = (
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
                  );
                  return interceptClick ? (
                    <div key={item.id} data-demo-target="flagged-invoice" onClick={() => onFlaggedInvoiceClick!(item.href)}>
                      {innerEl}
                    </div>
                  ) : (
                    <Link key={item.id} href={item.href}>
                      {innerEl}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SUB Quick Actions panel ────────────────────────────────────────────────────
function SubQuickActions({
  subcontracts,
  pendingCOCount,
}: {
  subcontracts: { id: string; projectName: string; gcCompanyName: string; status: string; contractValue: number | null }[];
  pendingCOCount: number;
}) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  // Upload submittal dialog state
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [selectedSubId, setSelectedSubId] = React.useState("");
  const [submittalName, setSubmittalName] = React.useState("");
  const [submittalMsg, setSubmittalMsg] = React.useState("");
  const [submittalDocPath, setSubmittalDocPath] = React.useState<string | null>(null);
  const [submittalDocName, setSubmittalDocName] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const { uploadFile, isUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Upload failed"),
  });

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result?.objectPath) {
      setSubmittalDocPath(result.objectPath);
      setSubmittalDocName(file.name);
    }
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubId) return toast.error("Please select a subcontract");
    if (!submittalName.trim()) return toast.error("Submittal name is required");
    if (!submittalDocPath) return toast.error("Please upload a document");
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/submittals/subcontracts/${selectedSubId}/submittals`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: submittalName.trim(),
          documentPath: submittalDocPath,
          documentName: submittalDocName,
          openingMessage: submittalMsg.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload submittal");
      }
      toast.success("Submittal uploaded and sent to GC");
      setUploadOpen(false);
      setSelectedSubId(""); setSubmittalName(""); setSubmittalMsg("");
      setSubmittalDocPath(null); setSubmittalDocName(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload submittal");
    } finally {
      setSaving(false);
    }
  };

  const getSubStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800">Active</span>;
      case "PENDING":
        return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Pending</span>;
      case "COMPLETE":
        return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">Complete</span>;
      default:
        return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">{status}</span>;
    }
  };

  return (
    <>
      {/* Quick Actions bar */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {/* Change Orders */}
          <Link href="/change-orders">
            <Button variant="outline" className="gap-2 min-h-[44px] relative">
              <GitPullRequest className="h-4 w-4" />
              Change Orders
              {pendingCOCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                  {pendingCOCount}
                </span>
              )}
            </Button>
          </Link>

          {/* Upload Submittal */}
          <Button
            variant="outline"
            className="gap-2 min-h-[44px]"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Upload Submittal
          </Button>
        </div>
      </div>

      {/* My Subcontracts section */}
      {subcontracts.length > 0 && (
        <div className="mb-8" id="my-subcontracts">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-muted-foreground" />
              My Subcontracts
            </h2>
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold leading-none">
              {subcontracts.length}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            {subcontracts.map((s, idx) => (
              <Link key={s.id} href={`/subcontracts/${s.id}`}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-muted/40",
                  idx < subcontracts.length - 1 && "border-b border-border/50"
                )}>
                  <div className="bg-primary/10 rounded-lg p-2 shrink-0">
                    <Receipt className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.projectName}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.gcCompanyName}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.contractValue !== null && (
                      <span className="text-sm font-mono font-semibold text-foreground hidden sm:block">
                        {formatCurrency(s.contractValue)}
                      </span>
                    )}
                    {getSubStatusBadge(s.status)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upload Submittal Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUploadOpen(false);
            setSelectedSubId(""); setSubmittalName(""); setSubmittalMsg("");
            setSubmittalDocPath(null); setSubmittalDocName(null);
          }
        }}
        title="Upload Submittal"
        description="Upload a document to send to the GC for review on a subcontract."
      >
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Subcontract *</label>
            <select
              className="flex w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedSubId}
              onChange={e => setSelectedSubId(e.target.value)}
              required
            >
              <option value="">Select a subcontract…</option>
              {subcontracts.map(s => (
                <option key={s.id} value={s.id}>
                  {s.projectName} — {s.gcCompanyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">Submittal Name *</label>
            <Input
              placeholder="e.g. Shop Drawings – Structural Steel"
              value={submittalName}
              onChange={e => setSubmittalName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">Document *</label>
            {submittalDocName ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 px-3 py-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="truncate flex-1 font-medium">{submittalDocName}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => { setSubmittalDocPath(null); setSubmittalDocName(null); }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors px-3 py-3 cursor-pointer text-sm text-muted-foreground">
                <Upload className="h-4 w-4 shrink-0" />
                {isUploading ? "Uploading…" : "Click to upload PDF, DWG, or image"}
                <input type="file" className="hidden" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.heic" onChange={handleDocUpload} disabled={isUploading} />
              </label>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">Message to GC <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder="Add context or notes for the GC…"
              value={submittalMsg}
              onChange={e => setSubmittalMsg(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="submit" className="min-h-[44px] gap-2" isLoading={saving || isUploading}>
              <Upload className="h-4 w-4" /> Send Submittal
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const { data: projects, isLoading } = useGetProjects();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const isGC = user?.role === "GC";
  const isDemoGC = (user as any)?.isDemo === true && isGC;
  const gcTeamRole = (user as any)?.gcTeamRole as string | null | undefined;

  // Demo gate state
  const [showGate, setShowGate] = React.useState(false);
  const [gatedHref, setGatedHref] = React.useState<string | null>(null);

  const handleFlaggedInvoiceClick = React.useCallback((href: string) => {
    if (isDemoGatePassed()) {
      setLocation(href);
      return;
    }
    setGatedHref(href);
    setShowGate(true);
  }, [setLocation]);

  const handleGateComplete = React.useCallback(() => {
    const href = gatedHref || "/subcontracts";
    setShowGate(false);
    setLocation(href);
    window.location.href = href;
  }, [gatedHref, setLocation]);

  const handleGateSkip = React.useCallback(() => {
    setShowGate(false);
    if (gatedHref) setLocation(gatedHref);
  }, [gatedHref, setLocation]);
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

  // Count total pending COs across all projects
  const pendingCOCount = subPendingCOProjects.length;

  type SubSubmittal = {
    id: string; name: string; projectName: string; gcCompanyName: string;
    openingMessage: string | null; requiredResponseDate: string | null;
    status: "PENDING_REVIEW" | "IN_DISCUSSION" | "ACKNOWLEDGED" | "OVERDUE";
    messageCount: number; lastMessagePreview: string | null; createdAt: string;
  };

  const { data: subSubmittals = [] } = useQuery<SubSubmittal[]>({
    queryKey: ["sub-submittals-dashboard"],
    queryFn: async () => {
      const res = await fetch(`${BASE_DASH}/api/submittals/sub-all`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isGC,
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const { data: subPaymentStatus } = useQuery<{ status: string }>({
    queryKey: ["sub-payment-status-dashboard"],
    queryFn: async () => {
      const res = await fetch(`${BASE_DASH}/api/stripe/connect/check-status`, { credentials: "include" });
      if (!res.ok) return { status: "NOT_SETUP" };
      return res.json();
    },
    enabled: !isGC,
    staleTime: 120_000,
    refetchOnMount: "always",
  });

  // Build subcontract list — now includes status + contractValue for the My Subcontracts section
  type SubQuickSub = { id: string; projectName: string; gcCompanyName: string; status: string; contractValue: number | null };
  const { data: subContractList = [] } = useQuery<SubQuickSub[]>({
    queryKey: ["sub-contract-list-quick"],
    queryFn: async () => {
      const res = await fetch(`${BASE_DASH}/api/subcontracts/my`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return (data as any[]).map((s: any) => ({
        id: s.id,
        projectName: s.project?.name ?? "Unknown Project",
        gcCompanyName: s.gc?.companyName ?? "GC",
        status: s.status ?? "ACTIVE",
        contractValue: s.contractValue ?? null,
      }));
    },
    enabled: !isGC,
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  usePageTitle("Projects");

  const onboardingKey = user ? `onboarding-dismissed-${user.id}` : null;
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  const payBannerKey = user ? `st_pay_banner_dismissed_${user.id}` : null;
  const [payBannerDismissed, setPayBannerDismissed] = React.useState(false);
  React.useEffect(() => {
    if (payBannerKey && sessionStorage.getItem(payBannerKey)) setPayBannerDismissed(true);
  }, [payBannerKey]);
  const dismissPayBanner = () => {
    if (payBannerKey) sessionStorage.setItem(payBannerKey, "1");
    setPayBannerDismissed(true);
  };

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
  const [addSubStep, setAddSubStep] = React.useState<"project" | "sub">("project");
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
    setAddSubLoading(false);
    setAddSubSuccess(null);
    setAddSubCopied(false);
    setAddSubNewResult(null);
  };

  const handleAddSubContactSelect = async (subId: string, companyName: string) => {
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
  };

  const handleAddSubNewNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSubEmail.trim() || !addSubCompanyName.trim()) return;
    handleAddSubInviteNew();
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

      {/* SUB: Payment Account Setup Banner — green, at very top, dismissible per-session */}
      {!isGC && !payBannerDismissed && subPaymentStatus?.status === "NOT_SETUP" && (
        <div className="mb-4 rounded-2xl bg-green-600 p-5 flex flex-col sm:flex-row sm:items-center gap-4 relative">
          <button
            onClick={dismissPayBanner}
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Banknote className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0 pr-6 sm:pr-0">
            <h3 className="font-bold text-white text-sm">Get paid faster.</h3>
            <p className="text-sm text-white/85 mt-0.5 leading-snug">Set up your bank account to receive GC payments directly — takes 5 minutes.</p>
          </div>
          <a href="/account/payment-setup" className="shrink-0">
            <Button className="min-h-[44px] gap-2 bg-white text-green-700 hover:bg-white/90 font-semibold">
              Set Up Now
            </Button>
          </a>
        </div>
      )}

      {/* SUB: Quick Actions + My Subcontracts */}


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
        <div data-demo-target="action-required">
          <ActionRequired
            items={actionItems}
            isLoading={actionItemsLoading}
            onFlaggedInvoiceClick={isDemoGC ? handleFlaggedInvoiceClick : undefined}
          />
        </div>
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
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{inv.gcCompanyName}</span>
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

      {/* SUB: Submittals Dashboard Section */}
      {!isGC && subSubmittals.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-primary/10 rounded-xl p-2">
              <Inbox className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-foreground">Submittals</h2>
              <p className="text-sm text-muted-foreground">Documents sent by the GC for your review, response, and acknowledgment.</p>
            </div>
          </div>
          <div className="space-y-3">
            {subSubmittals.map(s => {
              const isActionRequired = s.status === "PENDING_REVIEW" || s.status === "OVERDUE";
              const isNew = s.messageCount === 0 && s.status === "PENDING_REVIEW";
              const statusConfig = {
                PENDING_REVIEW: { label: "Pending Review", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800" },
                IN_DISCUSSION: { label: "In Discussion", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800" },
                ACKNOWLEDGED: { label: "Acknowledged", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800" },
                OVERDUE: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" },
              }[s.status];
              return (
                <div key={s.id} className={cn(
                  "rounded-2xl border-2 p-4",
                  s.status === "OVERDUE" && "border-red-400 bg-red-50 dark:bg-red-950/20",
                  s.status === "PENDING_REVIEW" && "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20",
                  s.status === "IN_DISCUSSION" && "border-blue-200 bg-blue-50/40 dark:bg-blue-950/10 dark:border-blue-800",
                  s.status === "ACKNOWLEDGED" && "border-border bg-card",
                )}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-xs font-semibold", statusConfig.className)}>{statusConfig.label}</Badge>
                        {isNew && (
                          <Badge className="text-xs bg-primary text-primary-foreground">NEW</Badge>
                        )}
                        {isActionRequired && !isNew && (
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700">Action Required</Badge>
                        )}
                      </div>
                      <p className="font-semibold text-foreground truncate">{s.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{s.projectName}</span>
                        <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{s.gcCompanyName}</span>
                        {s.requiredResponseDate && (
                          <span className={cn(
                            "flex items-center gap-1",
                            s.status === "OVERDUE" ? "text-red-600 dark:text-red-400 font-semibold" : ""
                          )}>
                            <CalendarDays className="h-3.5 w-3.5" /> Due {s.requiredResponseDate}
                          </span>
                        )}
                        {s.messageCount > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" /> {s.messageCount} message{s.messageCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {s.openingMessage && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic truncate max-w-md">"{s.openingMessage}"</p>
                      )}
                    </div>
                    <Link href={`/submittals/${s.id}`}>
                      <Button size="sm" variant={isActionRequired ? "default" : "outline"} className="gap-1.5 min-h-[44px] shrink-0">
                        <ExternalLink className="h-4 w-4" /> View &amp; Respond
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
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
          addSubSuccess || addSubNewResult ? "Invitation Sent!" :
          addSubStep === "sub" ? `Invite Sub to Bid — ${selectedProject?.name}` :
          "Invite Sub to Bid"
        }
        description={
          addSubStep === "project" ? "Choose which project to invite the subcontractor to." :
          selectedProjectIsConstruction ? "Sending a bid invitation for additional scope on this active project." :
          undefined
        }
      >
        {/* ─── SUCCESS ─── */}
        {addSubSuccess ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-semibold text-green-800 dark:text-green-300">
                  An invitation has been sent to <span className="font-bold">{addSubSuccess.companyName}</span>.
                </p>
                <p className="text-sm text-green-700 dark:text-green-400">They will receive a magic link to view your plans and submit their bid.</p>
                <p className="text-sm text-green-700 dark:text-green-400">You will be notified when their bid is received.</p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1 pt-2 border-t border-green-200 dark:border-green-800">There is no amount to enter at this stage — the sub submits their own bid.</p>
              </div>
            </div>
            <div className="flex gap-3 flex-col-reverse sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => { setAddSubSuccess(null); setAddSubStep("project"); setAddSubProjectId(""); setAddSubTab("contact"); setAddSubContactSearch(""); setAddSubEmail(""); setAddSubCompanyName(""); }} className="min-h-[44px]">
                Invite Another
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

        /* ─── STEP 2: select sub (contact book or new) ─── */
        ) : (
          <div className="mt-4">
            {selectedProjectIsConstruction && (
              <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 font-medium">
                Adding a sub mid-construction? They'll receive a bid invitation and can submit their proposed amount.
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
                            variant={alreadyMember ? "outline" : "default"}
                            disabled={alreadyMember || addSubLoading}
                            onClick={() => !alreadyMember && handleAddSubContactSelect(contact.subId, contact.sub.companyName)}
                            className="min-h-[44px] shrink-0"
                          >
                            {alreadyMember ? "Already added" : addSubLoading ? "Adding…" : "Add to Project"}
                          </Button>
                        </div>
                      );
                    })
                  }
                </div>
                <div className="flex justify-start pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAddSubStep("project")} className="gap-1 text-muted-foreground">
                    ← Back
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddSubNewNext} className="space-y-3">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Company Name *</label>
                  <Input placeholder="e.g. Apex Electrical" value={addSubCompanyName} onChange={e => setAddSubCompanyName(e.target.value)} required />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Email *</label>
                  <Input type="email" placeholder="sub@example.com" value={addSubEmail} onChange={e => setAddSubEmail(e.target.value)} required />
                </div>
                <div className="flex gap-3 justify-between pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAddSubStep("project")} className="gap-1 text-muted-foreground">
                    ← Back
                  </Button>
                  <Button type="submit" className="min-h-[44px] gap-2" isLoading={addSubLoading}>
                    <Mail className="h-4 w-4" /> Send Invitation
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>

      {isDemoGC && showGate && (
        <DemoGateModal
          open={showGate}
          onComplete={handleGateComplete}
          onSkip={handleGateSkip}
        />
      )}

      {/* Create Project Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Create New Project"
        description="Add a new project to start inviting subcontractors."
      >
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Project Name *</label>
            <Input placeholder="e.g. Downtown Office Renovation" value={newName} onChange={e => setNewName(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Address <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input placeholder="123 Main St, City, State" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder="Brief description of the project scope…"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Estimated Start Date <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-2 block">Labor Type</label>
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button type="button" className={`flex-1 py-2.5 text-sm font-medium transition-colors ${newLaborType === "non-union" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`} onClick={() => setNewLaborType("non-union")}>
                Non-Union
              </button>
              <button type="button" className={`flex-1 py-2.5 text-sm font-medium transition-colors ${newLaborType === "union" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`} onClick={() => setNewLaborType("union")}>
                Union
              </button>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" className="min-h-[44px] gap-2" isLoading={createProject.isPending}>
              <Plus className="h-4 w-4" /> Create Project
            </Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
