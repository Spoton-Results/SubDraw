import * as React from "react";
import { useLocation } from "wouter";
import {
  Users, TrendingUp, CreditCard, Activity, Shield, LogOut, Search, Filter, ChevronDown,
  Loader2, AlertTriangle, HardHat, Play, Pause, Clock, BarChart2, FileText,
  Mail, Trash2, UserX, RefreshCw, Eye, CheckCircle, XCircle, Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow, format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";

const BASE = import.meta.env.BASE_URL;

const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

type Tab = "overview" | "accounts" | "revenue" | "trials" | "activity" | "audit";

interface Metrics {
  totalGCs: number; activePaying: number; onTrial: number; churned: number;
  totalSubs: number; totalActiveSubcontracts: number; totalProjects: number;
  mrr: number; arr: number; totalRevenue: number;
}

interface GCAccount {
  id: string; companyName: string; email: string;
  planName: string | null; planLabel: string | null; planLimit: number | null;
  billingInterval: string | null; activeSubcontracts: number; projectCount: number;
  trialDaysLeft: number | null; createdAt: string; lastLoginAt: string | null;
  monthlyRevenue: number; status: string; pausedAt: string | null;
  adminPlanOverride: string | null; adminNotes: string | null;
}

interface TrialAccount {
  id: string; companyName: string; email: string;
  trialEndsAt: string; trialDaysLeft: number;
  projectCount: number; subcontractCount: number; lastLoginAt: string | null; createdAt: string;
}

interface ImpersonationLog {
  id: string; adminEmail: string; gcCompanyName: string; gcEmail: string;
  startedAt: string; endedAt: string | null; ipAddress: string | null;
}

const PLAN_OPTIONS = [
  { value: "", label: "Clear override (use Stripe)" },
  { value: "SubTracker Starter", label: "Starter" },
  { value: "SubTracker Growth", label: "Growth" },
  { value: "SubTracker Scale", label: "Scale" },
  { value: "SubTracker Enterprise", label: "Enterprise" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  trial:     { label: "Trial",     cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  past_due:  { label: "Past Due",  cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  paused:    { label: "Paused",    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

function MetricCard({ icon, label, value, sub, color = "primary" }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green:   "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    blue:    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    orange:  "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    slate:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    purple:  "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl mb-3 ${colorMap[color] ?? colorMap.primary}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold">{typeof value === "number" && label.toLowerCase().includes("revenue") ? `$${value.toLocaleString()}` : value.toLocaleString()}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-base">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = React.useState<Tab>("overview");
  const [adminEmail, setAdminEmail] = React.useState<string | null>(null);
  const [authChecking, setAuthChecking] = React.useState(true);

  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [accounts, setAccounts] = React.useState<GCAccount[]>([]);
  const [trials, setTrials] = React.useState<TrialAccount[]>([]);
  const [activity, setActivity] = React.useState<any[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<ImpersonationLog[]>([]);
  const [revenueData, setRevenueData] = React.useState<any>(null);

  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [revenueLoading, setRevenueLoading] = React.useState(false);
  const [trialsLoading, setTrialsLoading] = React.useState(false);
  const [activityLoading, setActivityLoading] = React.useState(false);
  const [auditLoading, setAuditLoading] = React.useState(false);

  // Accounts filters
  const [search, setSearch] = React.useState("");
  const [planFilter, setPlanFilter] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("newest");

  // Modals
  const [extendModal, setExtendModal] = React.useState<GCAccount | null>(null);
  const [planModal, setPlanModal] = React.useState<GCAccount | null>(null);
  const [msgModal, setMsgModal] = React.useState<GCAccount | null>(null);
  const [deleteModal, setDeleteModal] = React.useState<GCAccount | null>(null);
  const [notesModal, setNotesModal] = React.useState<GCAccount | null>(null);
  const [cancelModal, setCancelModal] = React.useState<GCAccount | null>(null);

  // Modal state
  const [extendDays, setExtendDays] = React.useState("7");
  const [selectedPlan, setSelectedPlan] = React.useState("");
  const [planExpireDays, setPlanExpireDays] = React.useState("");
  const [msgSubject, setMsgSubject] = React.useState("");
  const [msgBody, setMsgBody] = React.useState("");
  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const [notesText, setNotesText] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

  // Auth check
  React.useEffect(() => {
    api("/me").then(r => {
      if (!r.ok) { setLocation("/admin"); return; }
      return r.json();
    }).then(d => { if (d) setAdminEmail(d.adminEmail); })
      .finally(() => setAuthChecking(false));
  }, []);

  // Load data based on tab
  React.useEffect(() => {
    if (authChecking) return;
    if (tab === "overview" && !metrics) loadMetrics();
    if (tab === "accounts" && accounts.length === 0) loadAccounts();
    if (tab === "revenue" && !revenueData) loadRevenue();
    if (tab === "trials" && trials.length === 0) loadTrials();
    if (tab === "activity" && activity.length === 0) loadActivity();
    if (tab === "audit" && auditLogs.length === 0) loadAuditLogs();
  }, [tab, authChecking]);

  const loadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const r = await api("/metrics");
      if (r.ok) setMetrics(await r.json());
    } finally { setMetricsLoading(false); }
  };

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const params = new URLSearchParams({ search, planFilter, sortBy });
      const r = await api(`/gc-accounts?${params}`);
      if (r.ok) setAccounts(await r.json());
    } finally { setAccountsLoading(false); }
  };

  const loadRevenue = async () => {
    setRevenueLoading(true);
    try {
      const r = await api("/revenue");
      if (r.ok) setRevenueData(await r.json());
    } finally { setRevenueLoading(false); }
  };

  const loadTrials = async () => {
    setTrialsLoading(true);
    try {
      const r = await api("/trials");
      if (r.ok) setTrials(await r.json());
    } finally { setTrialsLoading(false); }
  };

  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const r = await api("/activity");
      if (r.ok) setActivity(await r.json());
    } finally { setActivityLoading(false); }
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const r = await api("/impersonation-logs");
      if (r.ok) setAuditLogs(await r.json());
    } finally { setAuditLoading(false); }
  };

  // Apply filters to accounts
  const filteredAccounts = React.useMemo(() => {
    let list = [...accounts];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.companyName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
    }
    if (planFilter !== "all") {
      if (planFilter === "paused") list = list.filter(a => a.status === "paused");
      else if (planFilter === "trial") list = list.filter(a => a.status === "trial");
      else if (planFilter === "cancelled") list = list.filter(a => a.status === "cancelled");
      else list = list.filter(a => a.planLabel?.toLowerCase() === planFilter.toLowerCase());
    }
    if (sortBy === "oldest") list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (sortBy === "highest_revenue") list.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
    else if (sortBy === "most_subcontracts") list.sort((a, b) => b.activeSubcontracts - a.activeSubcontracts);
    else if (sortBy === "last_login") list.sort((a, b) => (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? ""));
    else list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [accounts, search, planFilter, sortBy]);

  // Actions
  const gcAction = async (userId: string, path: string, method = "POST", body?: object) => {
    const r = await api(`/gc/${userId}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Action failed");
    return d;
  };

  const handlePause = async (account: GCAccount) => {
    try {
      const path = account.pausedAt ? "/unpause" : "/pause";
      await gcAction(account.id, path);
      toast.success(account.pausedAt ? "Account unpaused" : "Account paused");
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, pausedAt: account.pausedAt ? null : new Date().toISOString(), status: account.pausedAt ? "active" : "paused" } : a));
    } catch (e: any) { toast.error(e.message); }
  };

  const handleImpersonate = async (account: GCAccount) => {
    try {
      await gcAction(account.id, "/impersonate");
      toast.success(`Now viewing as ${account.companyName}`);
      // Navigate to main app
      window.location.href = import.meta.env.BASE_URL;
    } catch (e: any) { toast.error(e.message); }
  };

  const handleExtendTrial = async () => {
    if (!extendModal) return;
    setActionLoading(true);
    try {
      await gcAction(extendModal.id, "/extend-trial", "POST", { days: Number(extendDays) });
      toast.success(`Trial extended by ${extendDays} days`);
      setExtendModal(null);
      setAccounts([]);
      loadAccounts();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleEditPlan = async () => {
    if (!planModal) return;
    setActionLoading(true);
    try {
      await gcAction(planModal.id, "/edit-plan", "POST", {
        planName: selectedPlan || null,
        expiresInDays: planExpireDays ? Number(planExpireDays) : null,
      });
      toast.success(selectedPlan ? `Plan set to ${selectedPlan}` : "Plan override cleared");
      setPlanModal(null);
      setAccounts([]);
      loadAccounts();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleSendMessage = async () => {
    if (!msgModal) return;
    if (!msgSubject.trim() || !msgBody.trim()) { toast.error("Subject and message are required"); return; }
    setActionLoading(true);
    try {
      await gcAction(msgModal.id, "/send-message", "POST", { subject: msgSubject, message: msgBody });
      toast.success("Message sent");
      setMsgModal(null); setMsgSubject(""); setMsgBody("");
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setActionLoading(true);
    try {
      await gcAction(cancelModal.id, "/cancel");
      toast.success("Account cancelled and email sent");
      setCancelModal(null);
      setAccounts([]);
      loadAccounts();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setActionLoading(true);
    try {
      const r = await api(`/gc/${deleteModal.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: deleteConfirm }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("Account deleted");
      setDeleteModal(null); setDeleteConfirm("");
      setAccounts(prev => prev.filter(a => a.id !== deleteModal.id));
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleSaveNotes = async () => {
    if (!notesModal) return;
    setActionLoading(true);
    try {
      await gcAction(notesModal.id, "/notes", "POST", { notes: notesText });
      toast.success("Notes saved");
      setAccounts(prev => prev.map(a => a.id === notesModal.id ? { ...a, adminNotes: notesText } : a));
      setNotesModal(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleAdminLogout = async () => {
    await api("/auth/logout", { method: "POST" });
    setLocation("/admin");
  };

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",  label: "Overview",  icon: <BarChart2 className="h-4 w-4" /> },
    { id: "accounts",  label: "Accounts",  icon: <Users className="h-4 w-4" /> },
    { id: "revenue",   label: "Revenue",   icon: <TrendingUp className="h-4 w-4" /> },
    { id: "trials",    label: "Trials",    icon: <Clock className="h-4 w-4" /> },
    { id: "activity",  label: "Activity",  icon: <Activity className="h-4 w-4" /> },
    { id: "audit",     label: "Audit Log", icon: <Shield className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-6 gap-4 shrink-0">
        <div className="flex items-center gap-2 font-bold text-base">
          <HardHat className="h-5 w-5 text-primary" />
          SubTracker
          <span className="text-red-500 text-xs font-semibold border border-red-500/50 rounded px-1.5 py-0.5 ml-1">ADMIN</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Shield className="h-4 w-4" />
          <span>{adminEmail}</span>
        </div>
        <button
          onClick={handleAdminLogout}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </header>

      {/* Tabs */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 flex gap-1 overflow-x-auto shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-red-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">Platform Overview</h1>
              <button
                onClick={() => { setMetrics(null); loadMetrics(); }}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            {metricsLoading ? (
              <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
            ) : metrics ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 mb-3">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="text-2xl font-bold">{metrics.totalGCs}</div>
                    <div className="text-sm text-slate-400 mt-0.5">Total GC Accounts</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-green-500/10 text-green-400 mb-3">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div className="text-2xl font-bold">{metrics.activePaying}</div>
                    <div className="text-sm text-slate-400 mt-0.5">Active Paying</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-yellow-500/10 text-yellow-400 mb-3">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="text-2xl font-bold">{metrics.onTrial}</div>
                    <div className="text-sm text-slate-400 mt-0.5">On Trial</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-red-500/10 text-red-400 mb-3">
                      <XCircle className="h-5 w-5" />
                    </div>
                    <div className="text-2xl font-bold">{metrics.churned}</div>
                    <div className="text-sm text-slate-400 mt-0.5">Churned / Expired</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="text-slate-400 text-sm mb-1">Monthly Recurring Revenue</div>
                    <div className="text-3xl font-bold text-green-400">${metrics.mrr.toLocaleString()}</div>
                    <div className="text-slate-500 text-xs mt-1">ARR: ${metrics.arr.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="text-slate-400 text-sm mb-1">Total Revenue</div>
                    <div className="text-3xl font-bold">${metrics.totalRevenue.toLocaleString()}</div>
                    <div className="text-slate-500 text-xs mt-1">All time from Stripe</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="text-slate-400 text-sm mb-1">Platform Usage</div>
                    <div className="flex items-baseline gap-3 mt-1">
                      <div>
                        <div className="text-2xl font-bold">{metrics.totalProjects}</div>
                        <div className="text-slate-500 text-xs">Projects</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{metrics.totalActiveSubcontracts}</div>
                        <div className="text-slate-500 text-xs">Active Subcontracts</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{metrics.totalSubs}</div>
                        <div className="text-slate-500 text-xs">SUB Accounts</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-center py-16">Failed to load metrics</div>
            )}
          </div>
        )}

        {/* ── Accounts Tab ── */}
        {tab === "accounts" && (
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
              <h1 className="text-xl font-bold flex-1">GC Accounts</h1>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search company or email..."
                    className="bg-slate-900 border border-slate-700 text-white rounded-xl pl-9 pr-4 py-2 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <select
                  value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="all">All Plans</option>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="scale">Scale</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="trial">Trial</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest_revenue">Highest Revenue</option>
                  <option value="most_subcontracts">Most Subcontracts</option>
                  <option value="last_login">Last Login</option>
                </select>
                <button
                  onClick={() => { setAccounts([]); loadAccounts(); }}
                  className="p-2 bg-slate-900 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>

            {accountsLoading ? (
              <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="text-left px-4 py-3 font-medium">Company</th>
                        <th className="text-left px-4 py-3 font-medium">Plan</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-right px-4 py-3 font-medium">MRR</th>
                        <th className="text-right px-4 py-3 font-medium">Subs</th>
                        <th className="text-left px-4 py-3 font-medium">Last Login</th>
                        <th className="text-right px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-12 text-slate-500">No accounts found</td></tr>
                      ) : filteredAccounts.map(account => {
                        const badge = STATUS_BADGE[account.status] ?? STATUS_BADGE.cancelled;
                        return (
                          <tr key={account.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{account.companyName}</div>
                              <div className="text-slate-500 text-xs">{account.email}</div>
                              {account.adminNotes && (
                                <div className="text-yellow-400/70 text-xs truncate max-w-[200px]" title={account.adminNotes}>
                                  📝 {account.adminNotes}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-white">{account.planLabel ?? (account.trialDaysLeft != null ? "Trial" : "—")}</div>
                              {account.trialDaysLeft != null && (
                                <div className="text-xs text-yellow-400">{account.trialDaysLeft}d left</div>
                              )}
                              {account.adminPlanOverride && (
                                <div className="text-xs text-purple-400">Admin override</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {account.monthlyRevenue > 0 ? `$${account.monthlyRevenue}/mo` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={account.planLimit && account.activeSubcontracts >= account.planLimit ? "text-red-400 font-semibold" : ""}>
                                {account.activeSubcontracts}
                              </span>
                              {account.planLimit && <span className="text-slate-500">/{account.planLimit}</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">
                              {account.lastLoginAt
                                ? formatDistanceToNow(new Date(account.lastLoginAt), { addSuffix: true })
                                : "Never"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleImpersonate(account)}
                                  title="Impersonate"
                                  className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handlePause(account)}
                                  title={account.pausedAt ? "Unpause" : "Pause"}
                                  className={`p-1.5 rounded-lg transition-colors ${account.pausedAt ? "hover:bg-green-500/20 text-green-400" : "hover:bg-orange-500/20 text-orange-400"}`}
                                >
                                  {account.pausedAt ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => { setExtendModal(account); setExtendDays("7"); }}
                                  title="Extend Trial"
                                  className="p-1.5 rounded-lg hover:bg-yellow-500/20 text-yellow-400 transition-colors"
                                >
                                  <Clock className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => { setPlanModal(account); setSelectedPlan(account.adminPlanOverride ?? ""); setPlanExpireDays(""); }}
                                  title="Edit Plan"
                                  className="p-1.5 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-colors"
                                >
                                  <CreditCard className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => { setMsgModal(account); setMsgSubject(""); setMsgBody(""); }}
                                  title="Send Message"
                                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors"
                                >
                                  <Mail className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => { setNotesModal(account); setNotesText(account.adminNotes ?? ""); }}
                                  title="Admin Notes"
                                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setCancelModal(account)}
                                  title="Cancel Account"
                                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                >
                                  <UserX className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => { setDeleteModal(account); setDeleteConfirm(""); }}
                                  title="Delete Account"
                                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Revenue Tab ── */}
        {tab === "revenue" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">Revenue Analytics</h1>
              <button onClick={() => { setRevenueData(null); loadRevenue(); }} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            {revenueLoading ? (
              <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
            ) : revenueData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="text-slate-400 text-xs mb-2">Trial Conversion Rate</div>
                    <div className="text-2xl font-bold">{revenueData.trialConversionRate}%</div>
                    <div className="text-xs text-slate-500 mt-1">{revenueData.trialConversionsThisMonth} conversions this month</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="text-slate-400 text-xs mb-2">Avg Revenue / GC</div>
                    <div className="text-2xl font-bold">${revenueData.avgRevenuePerGC}/mo</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:col-span-2">
                    <div className="text-slate-400 text-xs mb-2">New Customers This Month</div>
                    <div className="text-2xl font-bold">{revenueData.newCustomersThisMonth?.length ?? 0}</div>
                    {revenueData.newCustomersThisMonth?.slice(0, 3).map((c: any) => (
                      <div key={c.email} className="text-xs text-slate-500 mt-1">{c.companyName}</div>
                    ))}
                  </div>
                </div>

                {revenueData.monthlyChart?.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
                    <div className="font-semibold mb-4 text-sm">Revenue by Month</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={revenueData.monthlyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                        <RechartsTooltip
                          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }}
                          formatter={(v: any) => [`$${v.toLocaleString()}`, "Revenue"]}
                        />
                        <Line type="monotone" dataKey="mrr" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <div className="font-semibold mb-4 text-sm">Revenue by Plan</div>
                  <div className="space-y-3">
                    {revenueData.revenueByPlan?.map((p: any) => (
                      <div key={p.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm">{p.label}</span>
                          <span className="text-xs text-slate-500">{p.count} accounts</span>
                        </div>
                        <span className="text-sm font-semibold">{p.mrr > 0 ? `$${p.mrr}/mo` : "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-center py-16">Failed to load revenue data</div>
            )}
          </div>
        )}

        {/* ── Trials Tab ── */}
        {tab === "trials" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">Trial Accounts</h1>
              <button onClick={() => { setTrials([]); loadTrials(); }} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            {trialsLoading ? (
              <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="text-left px-4 py-3 font-medium">Company</th>
                      <th className="text-right px-4 py-3 font-medium">Days Left</th>
                      <th className="text-right px-4 py-3 font-medium">Projects</th>
                      <th className="text-right px-4 py-3 font-medium">Subcontracts</th>
                      <th className="text-left px-4 py-3 font-medium">Last Login</th>
                      <th className="text-left px-4 py-3 font-medium">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trials.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-slate-500">No active trials</td></tr>
                    ) : trials.map(t => (
                      <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{t.companyName}</div>
                          <div className="text-slate-500 text-xs">{t.email}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${t.trialDaysLeft <= 3 ? "text-red-400" : t.trialDaysLeft <= 7 ? "text-yellow-400" : "text-green-400"}`}>
                            {t.trialDaysLeft}d
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{t.projectCount}</td>
                        <td className="px-4 py-3 text-right">{t.subcontractCount}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {t.lastLoginAt ? formatDistanceToNow(new Date(t.lastLoginAt), { addSuffix: true }) : "Never"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {format(new Date(t.createdAt), "MMM d, yyyy")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Activity Tab ── */}
        {tab === "activity" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">Platform Activity</h1>
              <button onClick={() => { setActivity([]); loadActivity(); }} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            {activityLoading ? (
              <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="text-left px-4 py-3 font-medium">Action</th>
                      <th className="text-left px-4 py-3 font-medium">Entity</th>
                      <th className="text-left px-4 py-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-12 text-slate-500">No activity</td></tr>
                    ) : activity.map((a, i) => (
                      <tr key={a.id ?? i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">{a.action}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {a.entityType && <span className="text-slate-500">{a.entityType}</span>}
                          {a.entityId && <span className="text-slate-600"> {a.entityId.slice(0, 8)}…</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Audit Log Tab ── */}
        {tab === "audit" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">Impersonation Audit Log</h1>
              <button onClick={() => { setAuditLogs([]); loadAuditLogs(); }} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            {auditLoading ? (
              <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="text-left px-4 py-3 font-medium">Admin</th>
                      <th className="text-left px-4 py-3 font-medium">GC Account</th>
                      <th className="text-left px-4 py-3 font-medium">Started</th>
                      <th className="text-left px-4 py-3 font-medium">Ended</th>
                      <th className="text-left px-4 py-3 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-slate-500">No impersonation sessions yet</td></tr>
                    ) : auditLogs.map(log => (
                      <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-300 text-xs">{log.adminEmail}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{log.gcCompanyName}</div>
                          <div className="text-slate-500 text-xs">{log.gcEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {format(new Date(log.startedAt), "MMM d, yyyy HH:mm")}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {log.endedAt ? format(new Date(log.endedAt), "MMM d, yyyy HH:mm") : (
                            <span className="text-yellow-400">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-mono">{log.ipAddress ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {extendModal && (
        <Modal title={`Extend Trial — ${extendModal.companyName}`} onClose={() => setExtendModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">How many additional days should be added to the trial?</p>
            <div>
              <label className="block text-sm font-medium mb-1.5">Days to add</label>
              <input
                type="number" min="1" value={extendDays}
                onChange={e => setExtendDays(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setExtendModal(null)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleExtendTrial} disabled={actionLoading} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Extend Trial
              </button>
            </div>
          </div>
        </Modal>
      )}

      {planModal && (
        <Modal title={`Edit Plan — ${planModal.companyName}`} onClose={() => setPlanModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Override the plan for this account without involving Stripe. Leave blank to use Stripe.</p>
            <div>
              <label className="block text-sm font-medium mb-1.5">Plan Override</label>
              <select
                value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {selectedPlan && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Expires in (days, optional)</label>
                <input
                  type="number" min="1" value={planExpireDays} onChange={e => setPlanExpireDays(e.target.value)}
                  placeholder="Leave blank for no expiry"
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPlanModal(null)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleEditPlan} disabled={actionLoading} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {msgModal && (
        <Modal title={`Send Message — ${msgModal.companyName}`} onClose={() => setMsgModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Subject</label>
              <input
                value={msgSubject} onChange={e => setMsgSubject(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Important update about your account"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Message</label>
              <textarea
                value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={5}
                className="w-full border border-border rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Your message..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMsgModal(null)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleSendMessage} disabled={actionLoading} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Send Email
              </button>
            </div>
          </div>
        </Modal>
      )}

      {notesModal && (
        <Modal title={`Admin Notes — ${notesModal.companyName}`} onClose={() => setNotesModal(null)}>
          <div className="space-y-4">
            <textarea
              value={notesText} onChange={e => setNotesText(e.target.value)} rows={6}
              className="w-full border border-border rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Internal notes about this account..."
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNotesModal(null)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleSaveNotes} disabled={actionLoading} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Notes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {cancelModal && (
        <Modal title={`Cancel Account — ${cancelModal.companyName}`} onClose={() => setCancelModal(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800 dark:text-orange-200">
                This will cancel the Stripe subscription at period end and send a cancellation email to {cancelModal.email}.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelModal(null)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleCancel} disabled={actionLoading} className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-2">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Cancel Account
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteModal && (
        <Modal title={`Delete Account — ${deleteModal.companyName}`} onClose={() => setDeleteModal(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>This is irreversible.</strong> All data for {deleteModal.companyName} will be permanently deleted, including all projects, subcontracts, and team members.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Type <span className="font-mono bg-muted px-1 rounded">{deleteModal.companyName}</span> to confirm
              </label>
              <input
                value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-destructive"
                placeholder={deleteModal.companyName}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={actionLoading || deleteConfirm !== deleteModal.companyName}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Permanently Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
