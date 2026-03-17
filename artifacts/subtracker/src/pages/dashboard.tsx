import * as React from "react";
import { Link } from "wouter";
import { useGetProjects, useCreateProject, getGetProjectsQueryKey, useGetMe, useGetGcDisputedInvoices } from "@workspace/api-client-react";
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
import { Plus, Briefcase, Building2, ChevronRight, FileSignature, DollarSign, AlertTriangle, MapPin, CalendarDays, ShieldAlert, Receipt, ExternalLink, CreditCard, Archive, ArchiveRestore, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getSubscriptionStatus } from "@/lib/stripe";
import { useQuery } from "@tanstack/react-query";
import { TrialBanner } from "@/components/trial-banner";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { data: user } = useGetMe();
  const { data: projects, isLoading } = useGetProjects();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const isGC = user?.role === "GC";
  const { data: gcDisputedInvoices = [] } = useGetGcDisputedInvoices({ query: { enabled: isGC } });

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
    enabled: isGC,
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

  const [archiveSearch, setArchiveSearch] = React.useState("");
  const [unarchivingId, setUnarchivingId] = React.useState<string | null>(null);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createProject.mutateAsync({ data: {
        name: newName.trim(),
        address: newAddress.trim() || undefined,
        description: newDescription.trim() || undefined,
        estimatedStartDate: newStartDate || undefined,
      }});
      toast.success("Project created!");
      queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
      setIsCreateOpen(false);
      setNewName("");
      setNewAddress("");
      setNewDescription("");
      setNewStartDate("");
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
          {isGC && (
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

      {/* Payment failure banner */}
      {isGC && subStatus?.isPastDue && (
        <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
          <CreditCard className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-red-800 dark:text-red-300 text-sm">Payment failed — please update your billing info to continue</div>
            <div className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              You have a 3-day grace period before new project creation is locked.
            </div>
          </div>
          <a href="/billing" className="text-xs font-semibold text-red-700 hover:underline shrink-0">Update billing →</a>
        </div>
      )}

      {showOnboarding && user && (
        <OnboardingBanner role={user.role as "GC" | "SUB"} onDismiss={dismissOnboarding} />
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
                      <div className="flex items-center gap-2">
                        {isGC && fs?.hasFlaggedInvoices && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" /> Flagged
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
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="min-h-[44px]">Cancel</Button>
            <Button type="submit" isLoading={createProject.isPending} className="min-h-[44px]">Create Project</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
