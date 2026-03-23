import * as React from "react";
import { Monitor, RefreshCw, Users, TrendingUp, Trash2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface DemoStats {
  gcDemoExists: boolean;
  subDemoExists: boolean;
  signups7d: number;
  signups30d: number;
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Demo Management</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Manage demo accounts and track conversion from demo to signup</p>
      </div>

      {/* Conversion stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Signups (last 7 days)</span>
          </div>
          <div className="text-2xl font-bold">{loading ? "—" : (stats?.signups7d ?? 0)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Signups (last 30 days)</span>
          </div>
          <div className="text-2xl font-bold">{loading ? "—" : (stats?.signups30d ?? 0)}</div>
        </div>
      </div>

      {/* Demo accounts */}
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
