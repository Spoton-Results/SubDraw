import * as React from "react";
import { Bell, X, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscribeToPush, dismissPushPrompt } from "@/lib/notifications";
import toast from "react-hot-toast";

interface Props {
  pushPromptLastSeenAt?: string | null;
  onDismiss: () => void;
}

function shouldShowPrompt(lastSeenAt?: string | null): boolean {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  if (Notification.permission === "granted" || Notification.permission === "denied") return false;
  if (!lastSeenAt) return true;
  const last = new Date(lastSeenAt).getTime();
  const now = Date.now();
  const daysSince = (now - last) / (1000 * 60 * 60 * 24);
  return daysSince >= 14;
}

export function PushPermissionPrompt({ pushPromptLastSeenAt, onDismiss }: Props) {
  const [visible, setVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!shouldShowPrompt(pushPromptLastSeenAt)) return;
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, [pushPromptLastSeenAt]);

  if (!visible) return null;

  const handleAllow = async () => {
    setLoading(true);
    try {
      const ok = await subscribeToPush();
      if (ok) {
        toast.success("Push notifications enabled!");
      } else if (Notification.permission === "denied") {
        toast.error("Notifications blocked — please enable them in your browser settings.");
      } else {
        toast.error("Could not enable push notifications.");
      }
    } catch {
      toast.error("Could not enable push notifications.");
    } finally {
      setLoading(false);
      setVisible(false);
      onDismiss();
    }
  };

  const handleDismiss = async () => {
    setVisible(false);
    onDismiss();
    await dismissPushPrompt().catch(() => {});
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(calc(100vw-2rem),420px)] bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Bell className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground leading-tight">Enable push notifications</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Get instant alerts for invoices, change orders, and payments — even when you're not in the app.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" onClick={handleAllow} disabled={loading} className="h-8 text-xs px-3">
            {loading ? "Enabling…" : "Enable"}
          </Button>
          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 h-8 flex items-center gap-1"
          >
            <BellOff className="h-3 w-3" />
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
