import * as React from "react";
import {
  TrendingUp, Users, Clock, AlertTriangle, XCircle, CreditCard, Target,
  ShieldAlert, Activity, Building2, Phone, BarChart2, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface MorningSummary {
  mrr: number;
  totalPaying: number;
  activeTrials: number;
  trialsExpiring7d: number;
  trialsExpiring3d: Array<{ companyName: string; email: string; userId: string; daysLeft: number }>;
  churnedThisMonth: number;
  mrrLostToChurn: number;
  nearLimitCount: number;
  churnRiskCount: number;
  failedPaymentsCount: number;
  // Platform health
  totalGCs?: number;
  totalSubs?: number;
  totalProjects?: number;
  demoClicks30d?: number;
}

interface FunnelStage {
  label: string;
  count: number;
}

function SummaryCard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    green:  "bg-green-500/10 text-green-500",
    blue:   "bg-blue-500/10 text-blue-500",
    yellow: "bg-yellow-500/10 text-yellow-500",
    red:    "bg-red-500/10 text-red-500",
    orange: "bg-orange-500/10 text-orange-500",
    purple: "bg-purple-500/10 text-purple-500",
    slate:  "bg-slate-500/10 text-slate-400",
    cyan:   "bg-cyan-500/10 text-cyan-500",
    rose:   "bg-rose-500/10 text-rose-500",
  };
  return (
    <div
      className={`bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 ${onClick ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
      onClick={onClick}
    >
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${colorMap[color] ?? colorMap.slate}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-sm font-medium text-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export function TabMorningSummary({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [data, setData] = React.useState<MorningSummary | null>(null);
  const [funnel, setFunnel] = React.useState<FunnelStage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/morning-summary").then(r => r.json()).catch(() => null),
      api("/funnel").then(r => r.json()).catch(() => ({ stages: [] })),
    ]).then(([summary, funnelData]) => {
      if (summary) setData(summary);
      setFunnel(funnelData?.stages ?? []);
    }).catch(() => toast.error("Failed to load summary")).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <div className="flex items-center gap-2"><div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Loading...</div>
    </div>
  );

  if (!data) return null;

  const maxFunnel = Math.max(...funnel.map(s => s.count), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Good morning</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{today} — here's what's happening</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Revenue & Accounts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Monthly Recurring Revenue" value={`$${data.mrr.toLocaleString()}`} sub="Active subscriptions" color="green" onClick={() => onNavigate?.("revenue")} />
          <SummaryCard icon={<CreditCard className="h-5 w-5" />} label="Paying Customers" value={data.totalPaying} sub="Active subscriptions" color="blue" onClick={() => onNavigate?.("accounts")} />
          <SummaryCard icon={<Clock className="h-5 w-5" />} label="Active Trials" value={data.activeTrials} sub="In trial period" color="purple" onClick={() => onNavigate?.("trials")} />
          <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="Trials Expiring Soon" value={data.trialsExpiring7d} sub="In the next 7 days" color={data.trialsExpiring7d > 0 ? "yellow" : "slate"} onClick={() => onNavigate?.("trials")} />
          <SummaryCard icon={<XCircle className="h-5 w-5" />} label="Churned This Month" value={data.churnedThisMonth} sub={data.mrrLostToChurn > 0 ? `$${data.mrrLostToChurn.toLocaleString()} MRR lost` : "No revenue impact"} color={data.churnedThisMonth > 0 ? "rose" : "slate"} onClick={() => onNavigate?.("accounts")} />
          <SummaryCard icon={<Target className="h-5 w-5" />} label="Near Plan Limit" value={data.nearLimitCount} sub="≥70% subcontract capacity" color={data.nearLimitCount > 0 ? "orange" : "slate"} onClick={() => onNavigate?.("upgrades")} />
          <SummaryCard icon={<ShieldAlert className="h-5 w-5" />} label="Churn Risk" value={data.churnRiskCount} sub="No login in 14+ days" color={data.churnRiskCount > 0 ? "red" : "slate"} onClick={() => onNavigate?.("churn")} />
          <SummaryCard icon={<Activity className="h-5 w-5" />} label="Failed Payments" value={data.failedPaymentsCount} sub="Past due subscriptions" color={data.failedPaymentsCount > 0 ? "red" : "slate"} onClick={() => onNavigate?.("support")} />
        </div>
      </div>

      {/* Platform Health */}
      {(data.totalGCs !== undefined) && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform Health</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard icon={<Building2 className="h-5 w-5" />} label="Total GC Accounts" value={data.totalGCs ?? 0} sub="All time" color="blue" onClick={() => onNavigate?.("accounts")} />
            <SummaryCard icon={<Users className="h-5 w-5" />} label="Total Sub Accounts" value={data.totalSubs ?? 0} sub="All time" color="slate" />
            <SummaryCard icon={<BarChart2 className="h-5 w-5" />} label="Total Projects" value={data.totalProjects ?? 0} sub="All time" color="green" />
            <SummaryCard icon={<Activity className="h-5 w-5" />} label="Demo Clicks (30d)" value={data.demoClicks30d ?? 0} sub="Marketing site" color="purple" onClick={() => onNavigate?.("demo")} />
          </div>
        </div>
      )}

      {/* Trials Expiring in 3 Days */}
      {data.trialsExpiring3d && data.trialsExpiring3d.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">⚠ Trials Expiring in 3 Days</h3>
            <button onClick={() => onNavigate?.("call-list")} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Phone className="h-3.5 w-3.5" /> Open Call List
            </button>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl overflow-hidden">
            {data.trialsExpiring3d.map((t, i) => (
              <div key={t.userId} className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? "border-t border-orange-200 dark:border-orange-800" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t.companyName}</div>
                  <div className="text-xs text-muted-foreground">{t.email}</div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={`text-sm font-bold ${t.daysLeft <= 1 ? "text-red-500" : "text-orange-500"}`}>
                    {t.daysLeft === 0 ? "Expires today" : `${t.daysLeft}d left`}
                  </div>
                </div>
                <a
                  href={`mailto:${t.email}?subject=Upgrade your SubDraw trial before it expires&body=Hi ${t.companyName},%0A%0A`}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-700 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  Email
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversion Funnel */}
      {funnel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Conversion Funnel (Last 30 Days)</h3>
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            {funnel.map((stage, i) => {
              const pct = maxFunnel > 0 ? Math.round((stage.count / maxFunnel) * 100) : 0;
              return (
                <div key={stage.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{stage.label}</span>
                    <span className="text-muted-foreground font-semibold">{stage.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${i === 0 ? "bg-blue-500" : i === 1 ? "bg-purple-500" : i === 2 ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {i > 0 && funnel[i - 1].count > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {Math.round((stage.count / funnel[i - 1].count) * 100)}% conversion from {funnel[i - 1].label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Items */}
      {(data.trialsExpiring7d > 0 || data.failedPaymentsCount > 0 || data.churnRiskCount > 0 || data.nearLimitCount > 0) && (
        <div className="border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-sm">Action Items</h3>
          <ul className="space-y-2">
            {(data.trialsExpiring3d?.length ?? 0) > 0 && (
              <li className="flex items-center gap-3 text-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <button className="text-foreground font-medium hover:text-primary" onClick={() => onNavigate?.("call-list")}>
                    {data.trialsExpiring3d!.length} trial{data.trialsExpiring3d!.length > 1 ? "s" : ""} expiring within 3 days
                  </button>
                  {" "}— call them now
                </span>
              </li>
            )}
            {data.trialsExpiring7d > 0 && (
              <li className="flex items-center gap-3 text-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <button className="text-foreground font-medium hover:text-primary" onClick={() => onNavigate?.("trials")}>
                    {data.trialsExpiring7d} trial{data.trialsExpiring7d > 1 ? "s" : ""} expiring within 7 days
                  </button>
                  {" "}— send follow-up emails
                </span>
              </li>
            )}
            {data.failedPaymentsCount > 0 && (
              <li className="flex items-center gap-3 text-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <button className="text-foreground font-medium hover:text-primary" onClick={() => onNavigate?.("support")}>
                    {data.failedPaymentsCount} account{data.failedPaymentsCount > 1 ? "s" : ""} with failed payments
                  </button>
                  {" "}— reach out before cancellation
                </span>
              </li>
            )}
            {data.churnRiskCount > 0 && (
              <li className="flex items-center gap-3 text-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <button className="text-foreground font-medium hover:text-primary" onClick={() => onNavigate?.("churn")}>
                    {data.churnRiskCount} account{data.churnRiskCount > 1 ? "s" : ""} at churn risk
                  </button>
                  {" "}— no login in 14+ days
                </span>
              </li>
            )}
            {data.nearLimitCount > 0 && (
              <li className="flex items-center gap-3 text-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <button className="text-foreground font-medium hover:text-primary" onClick={() => onNavigate?.("upgrades")}>
                    {data.nearLimitCount} account{data.nearLimitCount > 1 ? "s" : ""} near plan limit
                  </button>
                  {" "}— upgrade opportunity
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
