import * as React from "react";
import { Loader2, Phone, X, CheckCircle, AlertTriangle, Clock, TrendingUp, Mail, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface CallItem {
  id: string;
  companyName: string;
  email: string;
  priority: "urgent" | "high" | "medium" | "low";
  reason: string;
  daysLeft: number | null;
  projects: number;
  activated: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  ageDays: number;
  lastCalled: string | null;
}

const PRIORITY_STYLES = {
  urgent: { label: "URGENT", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  high:   { label: "HIGH",   cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  medium: { label: "MEDIUM", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: <Clock className="h-3.5 w-3.5" /> },
  low:    { label: "LOW",    cls: "bg-slate-100 text-muted-foreground dark:bg-muted", icon: <CheckCircle className="h-3.5 w-3.5" /> },
};

export function TabCallList({ onNavigate }: { onNavigate?: (tab: string, extra?: string) => void }) {
  const [items, setItems] = React.useState<CallItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [callingId, setCallingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api("/call-list").then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => toast.error("Failed to load call list")).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const dismiss = async (id: string) => {
    await api(`/call-list/dismiss/${id}`, { method: "POST" });
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Removed for 24 hours");
  };

  const markCalled = async (item: CallItem) => {
    setCallingId(item.id);
    await api(`/call-list/mark-called/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: `Called ${item.companyName}` }),
    });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, lastCalled: new Date().toISOString() } : i));
    toast.success("Call recorded");
    setCallingId(null);
  };

  const urgentCount = items.filter(i => i.priority === "urgent").length;
  const highCount = items.filter(i => i.priority === "high").length;
  const needsAction = urgentCount + highCount;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Call List</h1>
        <button onClick={load} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Summary banner */}
      {!loading && (
        <div className={`rounded-2xl p-4 mb-6 flex items-center gap-3 ${needsAction > 0 ? "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800" : "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"}`}>
          {needsAction > 0
            ? <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            : <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
          <div>
            <div className={`text-sm font-semibold ${needsAction > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
              {needsAction > 0
                ? `${needsAction} account${needsAction !== 1 ? "s" : ""} need immediate action today`
                : "No urgent actions needed today"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {items.length} total accounts on the call list • {urgentCount} urgent • {highCount} high priority
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <div className="font-medium">Call list is clear</div>
          <div className="text-sm mt-1">No accounts need outreach right now</div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const p = PRIORITY_STYLES[item.priority];
            return (
              <div key={item.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${p.cls}`}>
                      {p.icon}{p.label}
                    </span>
                    <span className="font-semibold text-sm truncate">{item.companyName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{item.email}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.reason}</div>
                  <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    {item.daysLeft !== null && <span>Trial: {item.daysLeft}d left</span>}
                    <span>Projects: {item.projects}</span>
                    <span>Signed up: {item.ageDays}d ago</span>
                    {item.lastLoginAt && <span>Last login: {formatDistanceToNow(new Date(item.lastLoginAt))} ago</span>}
                    {item.lastCalled && <span className="text-green-600 dark:text-green-400">Called: {formatDistanceToNow(new Date(item.lastCalled))} ago</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <a
                    href={`mailto:${item.email}?subject=Following up on your SubTracker trial&body=Hi ${item.companyName},%0A%0A`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border hover:bg-muted transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" /> Email
                  </a>
                  <button
                    onClick={() => markCalled(item)}
                    disabled={callingId === item.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {callingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                    Mark Called
                  </button>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate("accounts", item.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border hover:bg-muted transition-colors"
                    >
                      View
                    </button>
                  )}
                  <button
                    onClick={() => dismiss(item.id)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Dismiss for 24 hours"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
