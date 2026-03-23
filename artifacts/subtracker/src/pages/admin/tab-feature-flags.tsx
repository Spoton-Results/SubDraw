import * as React from "react";
import { Flag, RefreshCw, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  globalEnabled: boolean;
  perAccountOverrides: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

function Toggle({ enabled, onChange, loading }: { enabled: boolean; onChange: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${enabled ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export function TabFeatureFlags() {
  const [flags, setFlags] = React.useState<FeatureFlag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api("/feature-flags").then(r => r.json()).then(setFlags).catch(() => toast.error("Failed to load feature flags")).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const toggleFlag = async (flag: FeatureFlag) => {
    setTogglingId(flag.id);
    try {
      const r = await api(`/feature-flags/${flag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalEnabled: !flag.globalEnabled }),
      });
      const updated = await r.json();
      if (!r.ok) throw new Error(updated.error ?? "Failed");
      setFlags(prev => prev.map(f => f.id === flag.id ? updated : f));
      toast.success(`${flag.name} ${updated.globalEnabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update flag");
    } finally {
      setTogglingId(null);
    }
  };

  const enabledCount = flags.filter(f => f.globalEnabled).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Feature Flags</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Toggle platform features globally — changes take effect immediately</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {enabledCount} of {flags.length} enabled
            </span>
          )}
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-lg transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Loading...
        </div>
      ) : flags.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
          <Flag className="h-8 w-8 opacity-40" />
          <p>No feature flags found</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flag Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Last Updated</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag, i) => (
                <tr key={flag.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{flag.name}</code>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 sm:hidden">{flag.description}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell max-w-xs">{flag.description}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {formatDistanceToNow(new Date(flag.updatedAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs font-medium ${flag.globalEnabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                        {flag.globalEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <Toggle
                        enabled={flag.globalEnabled}
                        onChange={() => toggleFlag(flag)}
                        loading={togglingId === flag.id}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Feature flags control whether specific platform features are available to users. Disabling a flag hides the feature from the UI but does not delete any data.
      </p>
    </div>
  );
}
