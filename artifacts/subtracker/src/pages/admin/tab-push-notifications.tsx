import * as React from "react";
import { Loader2, Send, Bell, Users, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

const BASE_ADMIN = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface PushStats {
  totalSubscriptions: number;
  gcSubscriptions: number;
  subSubscriptions: number;
  uniqueUsers: number;
}

export function TabPushNotifications() {
  const [stats, setStats] = React.useState<PushStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [url, setUrl] = React.useState("/dashboard");
  const [target, setTarget] = React.useState<"all" | "gc" | "sub">("all");

  const loadStats = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_ADMIN}/api/admin/push/stats`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } catch {}
    setLoading(false);
  };

  React.useEffect(() => { loadStats(); }, []);

  const handleBroadcast = async () => {
    if (!title.trim() || !body.trim()) { toast.error("Title and body are required"); return; }
    setSending(target);
    try {
      const r = await fetch(`${BASE_ADMIN}/api/admin/push/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || "/dashboard", target }),
      });
      const data = await r.json();
      if (r.ok) {
        toast.success(`Push sent to ${data.sent} subscriber${data.sent !== 1 ? "s" : ""} (${data.failed} failed)`);
        setTitle(""); setBody(""); setUrl("/dashboard");
      } else {
        toast.error(data.error ?? "Broadcast failed");
      }
    } catch { toast.error("Broadcast failed"); }
    setSending(null);
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Push Notifications</h1>
        <button onClick={loadStats} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Subscriptions", value: stats.totalSubscriptions, icon: <Bell className="h-5 w-5" />, color: "text-blue-400 bg-blue-500/10" },
            { label: "Unique Users", value: stats.uniqueUsers, icon: <CheckCircle className="h-5 w-5" />, color: "text-green-400 bg-green-500/10" },
            { label: "GC Subscriptions", value: stats.gcSubscriptions, icon: <Users className="h-5 w-5" />, color: "text-purple-400 bg-purple-500/10" },
            { label: "Sub Subscriptions", value: stats.subSubscriptions, icon: <Users className="h-5 w-5" />, color: "text-orange-400 bg-orange-500/10" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4">
              <div className={`inline-flex items-center justify-center h-9 w-9 rounded-xl mb-3 ${color}`}>{icon}</div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Broadcast Form */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" /> Broadcast Push Notification
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Audience</label>
            <div className="flex gap-2">
              {(["all", "gc", "sub"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    target === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "all" ? "All Users" : t === "gc" ? "GC Only" : "SUBs Only"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. System Update"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              placeholder="e.g. We've added new features to SubDraw…"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Destination URL (path)</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="/dashboard"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <Button
            onClick={handleBroadcast}
            disabled={!!sending}
            className="gap-2 w-full min-h-[44px]"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : "Send Push Notification"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Only users who have granted notification permission will receive this push.
          </p>
        </div>
      </div>
    </div>
  );
}
