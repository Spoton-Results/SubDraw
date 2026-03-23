import * as React from "react";
import { Target, Mail, RefreshCw, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface UpgradeAccount {
  id: string;
  companyName: string;
  email: string;
  planLabel: string;
  planName: string;
  activeCount: number;
  limit: number;
  usagePercent: number;
  nextPlanLabel: string | null;
  nextPlanName: string | null;
  nextPlanMonthlyUsd: number | null;
  lastLoginAt: string | null;
}

function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${pct >= 90 ? "text-red-500" : pct >= 70 ? "text-orange-500" : "text-muted-foreground"}`}>{pct}%</span>
    </div>
  );
}

export function TabUpgradeOpportunities() {
  const [accounts, setAccounts] = React.useState<UpgradeAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sendingId, setSendingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api("/upgrade-opportunities").then(r => r.json()).then(setAccounts).catch(() => toast.error("Failed to load data")).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const sendUpgradeOffer = async (account: UpgradeAccount) => {
    setSendingId(account.id);
    try {
      const r = await api(`/gc/${account.id}/offer-upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextPlanName: account.nextPlanName }),
      });
      if (!r.ok) throw new Error();
      toast.success(`Upgrade offer sent to ${account.email}`);
    } catch {
      toast.error("Failed to send upgrade offer");
    } finally {
      setSendingId(null);
    }
  };

  const critical = accounts.filter(a => a.usagePercent >= 90).length;
  const nearLimit = accounts.filter(a => a.usagePercent >= 70 && a.usagePercent < 90).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Upgrade Opportunities</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Accounts using 70%+ of their subcontract limit</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-lg transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-red-500">{critical}</div>
          <div className="text-xs text-muted-foreground mt-0.5">At or over limit (≥90%)</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-500">{nearLimit}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Near limit (70–89%)</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Loading...
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
          <Target className="h-8 w-8 opacity-40" />
          <p>No accounts near their limit right now</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-40">Usage</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subs</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Next Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Login</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, i) => (
                  <tr key={a.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.companyName}</div>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-medium">{a.planLabel}</span>
                    </td>
                    <td className="px-4 py-3 w-40">
                      <UsageBar pct={a.usagePercent} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.activeCount} / {a.limit}</td>
                    <td className="px-4 py-3">
                      {a.nextPlanLabel ? (
                        <span className="text-xs">
                          {a.nextPlanLabel}
                          {a.nextPlanMonthlyUsd && <span className="text-muted-foreground"> (${a.nextPlanMonthlyUsd}/mo)</span>}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">Enterprise (max)</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.lastLoginAt ? formatDistanceToNow(new Date(a.lastLoginAt), { addSuffix: true }) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={sendingId === a.id || !a.nextPlanLabel}
                        onClick={() => sendUpgradeOffer(a)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        <Mail className="h-3 w-3" />
                        {sendingId === a.id ? "Sending..." : "Offer Upgrade"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
