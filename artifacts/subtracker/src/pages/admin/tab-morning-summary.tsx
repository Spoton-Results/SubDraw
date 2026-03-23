import * as React from "react";
import { TrendingUp, Users, Clock, AlertTriangle, XCircle, CreditCard, Target, ShieldAlert, Activity } from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface MorningSummary {
  mrr: number;
  totalPaying: number;
  activeTrials: number;
  trialsExpiring7d: number;
  churnedThisMonth: number;
  mrrLostToChurn: number;
  nearLimitCount: number;
  churnRiskCount: number;
  failedPaymentsCount: number;
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
  const [loading, setLoading] = React.useState(true);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  React.useEffect(() => {
    setLoading(true);
    api("/morning-summary").then(r => r.json()).then(setData).catch(e => toast.error("Failed to load summary")).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <div className="flex items-center gap-2"><div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Loading...</div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Good morning</h2>
        <p className="text-muted-foreground text-sm mt-0.5">{today} — here's what's happening</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Monthly Recurring Revenue"
          value={`$${data.mrr.toLocaleString()}`}
          sub="From active subscriptions"
          color="green"
          onClick={() => onNavigate?.("revenue")}
        />
        <SummaryCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Paying Customers"
          value={data.totalPaying}
          sub="Active subscriptions"
          color="blue"
          onClick={() => onNavigate?.("accounts")}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5" />}
          label="Active Trials"
          value={data.activeTrials}
          sub="In trial period"
          color="purple"
          onClick={() => onNavigate?.("trials")}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Trials Expiring Soon"
          value={data.trialsExpiring7d}
          sub="In the next 7 days"
          color={data.trialsExpiring7d > 0 ? "yellow" : "slate"}
          onClick={() => onNavigate?.("trials")}
        />
        <SummaryCard
          icon={<XCircle className="h-5 w-5" />}
          label="Churned This Month"
          value={data.churnedThisMonth}
          sub={data.mrrLostToChurn > 0 ? `$${data.mrrLostToChurn.toLocaleString()} MRR lost` : "No revenue impact"}
          color={data.churnedThisMonth > 0 ? "rose" : "slate"}
          onClick={() => onNavigate?.("accounts")}
        />
        <SummaryCard
          icon={<Target className="h-5 w-5" />}
          label="Near Plan Limit"
          value={data.nearLimitCount}
          sub="≥70% of subcontract capacity"
          color={data.nearLimitCount > 0 ? "orange" : "slate"}
          onClick={() => onNavigate?.("upgrades")}
        />
        <SummaryCard
          icon={<ShieldAlert className="h-5 w-5" />}
          label="Churn Risk Accounts"
          value={data.churnRiskCount}
          sub="No login in 14+ days"
          color={data.churnRiskCount > 0 ? "red" : "slate"}
          onClick={() => onNavigate?.("churn")}
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5" />}
          label="Failed Payments"
          value={data.failedPaymentsCount}
          sub="Past due subscriptions"
          color={data.failedPaymentsCount > 0 ? "red" : "slate"}
          onClick={() => onNavigate?.("support")}
        />
      </div>

      {/* Quick Action Callouts */}
      {(data.trialsExpiring7d > 0 || data.failedPaymentsCount > 0 || data.churnRiskCount > 0) && (
        <div className="border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-sm">Action Items</h3>
          <ul className="space-y-2">
            {data.trialsExpiring7d > 0 && (
              <li className="flex items-center gap-3 text-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <button className="text-foreground font-medium hover:text-primary" onClick={() => onNavigate?.("trials")}>
                    {data.trialsExpiring7d} trial{data.trialsExpiring7d > 1 ? "s" : ""} expiring
                  </button>
                  {" "}within 7 days — send follow-up emails
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
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
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
