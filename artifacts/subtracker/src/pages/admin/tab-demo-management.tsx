import * as React from "react";
import { Monitor, RefreshCw, Users, TrendingUp, Trash2, AlertTriangle, MousePointerClick, Globe, BarChart2, ArrowUpRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface DemoSession {
  id: string;
  eventType: string;
  ipAddress: string | null;
  createdAt: string;
}

interface TopPage {
  path: string;
  views: number;
}

interface DemoStats {
  gcDemoExists: boolean;
  subDemoExists: boolean;
  signups7d: number;
  signups30d: number;
  gcClicks7d: number;
  gcClicks30d: number;
  subClicks7d: number;
  subClicks30d: number;
  conversionRate: number | null;
  recentSessions: DemoSession[];
  pageViews7d: number;
  uniquePaths7d: number;
  topPages: TopPage[];
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number | null; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value === null ? "—" : value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function TabDemoManagement() {
  const [stats, setStats] = React.useState<DemoStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [resetting, setResetting] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api("/demo/stats").then(r => r.json()).then(setStats).catch(() => toast.error("Failed to load demo stats")).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const resetDemo = async (type: "gc" | "sub" | "all") => {
    if (confirm !== type) {
      setConfirm(type);
      return;
    }
    setResetting(type);
    setConfirm(null);
    try {
      const r = await api("/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast.success(data.message);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Reset failed");
    } finally {
      setResetting(null);
    }
  };

  const DEMO_ACCOUNTS = [
    {
      type: "gc" as const,
      label: "GC Demo Account",
      desc: "The general contractor demo login shown on the sign-in page",
      exists: stats?.gcDemoExists,
    },
    {
      type: "sub" as const,
      label: "Sub Demo Account",
      desc: "The subcontractor demo account linked to the GC demo",
      exists: stats?.subDemoExists,
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Demo Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track demo button clicks, conversion rates, and site traffic</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Demo Click Metrics ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          Demo Button Clicks
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={TrendingUp} label="GC Clicks (7d)" value={loading ? "—" : (stats?.gcClicks7d ?? 0)} />
          <StatCard icon={TrendingUp} label="GC Clicks (30d)" value={loading ? "—" : (stats?.gcClicks30d ?? 0)} />
          <StatCard icon={Users} label="Sub Clicks (7d)" value={loading ? "—" : (stats?.subClicks7d ?? 0)} />
          <StatCard icon={Users} label="Sub Clicks (30d)" value={loading ? "—" : (stats?.subClicks30d ?? 0)} />
        </div>
      </div>

      {/* ── Conversion Metrics ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          Conversion to Signup (30d)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={Users} label="Signups (7d)" value={loading ? "—" : (stats?.signups7d ?? 0)} />
          <StatCard icon={Users} label="Signups (30d)" value={loading ? "—" : (stats?.signups30d ?? 0)} />
          <StatCard
            icon={TrendingUp}
            label="Conversion Rate (30d)"
            value={loading ? "—" : stats?.conversionRate !== null && stats?.conversionRate !== undefined ? `${stats.conversionRate}%` : "No data"}
            sub="Demo clicks → GC signups"
          />
        </div>
      </div>

      {/* ── Recent Demo Sessions ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          Recent Demo Sessions
        </h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">IP Address</th>
                <th className="text-left px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground text-xs">Loading...</td></tr>
              ) : !stats?.recentSessions?.length ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground text-xs">No demo sessions recorded yet. Demo button clicks will appear here.</td></tr>
              ) : stats.recentSessions.map(s => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.eventType === "GC_DEMO"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    }`}>
                      {s.eventType === "GC_DEMO" ? "GC Demo" : "Sub Demo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                    {s.ipAddress ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Site Traffic ──────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Site Traffic (last 7 days)
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard icon={BarChart2} label="Page Views (7d)" value={loading ? "—" : (stats?.pageViews7d ?? 0)} />
          <StatCard icon={Globe} label="Unique Pages (7d)" value={loading ? "—" : (stats?.uniquePaths7d ?? 0)} sub="Distinct paths visited" />
        </div>
        {stats?.topPages && stats.topPages.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-xs text-muted-foreground font-medium">Top Pages (7d)</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left px-4 py-2 font-medium">Path</th>
                  <th className="text-right px-4 py-2 font-medium">Views</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPages.map((p, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs font-mono text-foreground/80">{p.path}</td>
                    <td className="px-4 py-2 text-xs text-right text-muted-foreground">{p.views.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (!stats?.topPages || stats.topPages.length === 0) && (
          <div className="text-center py-6 text-xs text-muted-foreground bg-card border border-border rounded-xl">
            No page views recorded yet. Page views will appear here once tracking is active.
          </div>
        )}
      </div>

      {/* ── Demo Accounts ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Demo Accounts</h3>
        {DEMO_ACCOUNTS.map(account => (
          <div key={account.type} className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${account.exists ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                <Monitor className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{account.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{account.desc}</div>
                <div className={`text-xs mt-1 font-medium ${account.exists ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {loading ? "Checking..." : account.exists ? "Active" : "Not found — will be recreated on server restart"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {confirm === account.type ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-500">Confirm reset?</span>
                  <button
                    onClick={() => resetDemo(account.type)}
                    disabled={resetting === account.type}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {resetting === account.type ? "Resetting..." : "Yes, Reset"}
                  </button>
                  <button onClick={() => setConfirm(null)} className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => resetDemo(account.type)}
                  disabled={resetting !== null || loading || !account.exists}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-red-500 hover:border-red-500/30 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                  Reset Demo Data
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Reset all */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">Reset All Demo Data</div>
                <div className="text-xs text-muted-foreground mt-0.5">Deletes both demo accounts. They will be regenerated on next server restart.</div>
              </div>
            </div>

            <div>
              {confirm === "all" ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Are you sure?</span>
                  <button
                    onClick={() => resetDemo("all")}
                    disabled={resetting === "all"}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {resetting === "all" ? "Resetting..." : "Yes, Reset All"}
                  </button>
                  <button onClick={() => setConfirm(null)} className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirm("all")}
                  disabled={resetting !== null || loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                  Reset All
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
