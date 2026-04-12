import * as React from "react";
import { ShieldAlert, Mail, Eye, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface ChurnRiskAccount {
  id: string;
  companyName: string;
  email: string;
  planLabel: string | null;
  risk: "red" | "yellow" | "green";
  reasons: string[];
  lastLoginAt: string | null;
  daysSinceLogin: number | null;
  createdAt: string;
  adminNotes: string | null;
}

const RISK_CONFIG = {
  red:    { label: "High Risk",    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",       dot: "bg-red-500" },
  yellow: { label: "Medium Risk",  cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", dot: "bg-yellow-500" },
  green:  { label: "Healthy",      cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  dot: "bg-green-500" },
};

export function TabChurnRisk() {
  const [accounts, setAccounts] = React.useState<ChurnRiskAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"all" | "red" | "yellow" | "green">("all");
  const [sendingId, setSendingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api("/churn-risk").then(r => r.json()).then(setAccounts).catch(() => toast.error("Failed to load churn risk data")).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? accounts : accounts.filter(a => a.risk === filter);

  const sendCheckin = async (account: ChurnRiskAccount) => {
    setSendingId(account.id);
    try {
      const r = await api(`/gc/${account.id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Checking in — how's SubDraw working for you?`,
          message: `Hi ${account.companyName},\n\nI wanted to personally reach out and see how things are going with SubDraw. Is there anything we can help with or improve for your team?\n\nJust reply to this email — we'd love to hear from you.\n\nBest,\nThe SubDraw Team`,
        }),
      });
      if (!r.ok) throw new Error();
      toast.success(`Check-in email sent to ${account.email}`);
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSendingId(null);
    }
  };

  const counts = { red: accounts.filter(a => a.risk === "red").length, yellow: accounts.filter(a => a.risk === "yellow").length, green: accounts.filter(a => a.risk === "green").length };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Churn Risk</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Paying accounts scored by engagement and payment health</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-lg transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Risk summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {(["red", "yellow", "green"] as const).map(r => (
          <button
            key={r}
            onClick={() => setFilter(filter === r ? "all" : r)}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${filter === r ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}
          >
            <span className={`inline-flex h-3 w-3 rounded-full flex-shrink-0 ${RISK_CONFIG[r].dot}`} />
            <div>
              <div className="text-xl font-bold">{counts[r]}</div>
              <div className="text-xs text-muted-foreground">{RISK_CONFIG[r].label}</div>
            </div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No accounts match this filter</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk Factors</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Login</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={a.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.companyName}</div>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.planLabel ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${RISK_CONFIG[a.risk].cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${RISK_CONFIG[a.risk].dot}`} />
                        {RISK_CONFIG[a.risk].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-0.5">
                        {a.reasons.map((r, j) => (
                          <li key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${a.risk === "red" ? "bg-red-500" : "bg-yellow-500"}`} />
                            {r}
                          </li>
                        ))}
                        {a.reasons.length === 0 && <li className="text-xs text-green-600 dark:text-green-400">No issues detected</li>}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.lastLoginAt ? formatDistanceToNow(new Date(a.lastLoginAt), { addSuffix: true }) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={sendingId === a.id}
                        onClick={() => sendCheckin(a)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        <Mail className="h-3 w-3" />
                        {sendingId === a.id ? "Sending..." : "Check-In"}
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
