import * as React from "react";
import { AlertTriangle, UserX, Mail, RefreshCw, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface SupportItem {
  id: string;
  companyName: string;
  email: string;
  planLabel?: string | null;
  amount?: number | null;
  lastLoginAt: string | null;
  createdAt: string;
  issue: "payment_failed" | "never_logged_in";
}

interface SupportQueue {
  failedPayments: SupportItem[];
  neverLoggedIn: SupportItem[];
}

export function TabSupportQueue() {
  const [data, setData] = React.useState<SupportQueue | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<"payments" | "never">("payments");

  const load = React.useCallback(() => {
    setLoading(true);
    api("/support-queue").then(r => r.json()).then(setData).catch(() => toast.error("Failed to load support queue")).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const sendEmail = async (item: SupportItem, type: "payment" | "onboard") => {
    setSendingId(item.id);
    try {
      const subject = type === "payment"
        ? "Action needed: Update your SubDraw payment method"
        : `Welcome to SubDraw — let's get you started`;
      const message = type === "payment"
        ? `Hi ${item.companyName},\n\nWe weren't able to process your most recent payment. To keep your SubDraw access uninterrupted, please update your payment method in Settings → Billing.\n\nIf you need help, just reply to this email.\n\nThe SubDraw Team`
        : `Hi ${item.companyName},\n\nWelcome to SubDraw! We noticed you haven't logged in yet. We'd love to help you get set up.\n\nYou can log in at: ${window.location.origin}\n\nIf you have any questions, just reply — we're happy to help.\n\nThe SubDraw Team`;

      const r = await api(`/gc/${item.id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      if (!r.ok) throw new Error();
      toast.success(`Email sent to ${item.email}`);
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSendingId(null);
    }
  };

  const items = section === "payments" ? (data?.failedPayments ?? []) : (data?.neverLoggedIn ?? []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Support Queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Accounts that may need immediate attention</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-lg transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Section selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setSection("payments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${section === "payments" ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Failed Payments
          {data && data.failedPayments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs leading-none">{data.failedPayments.length}</span>
          )}
        </button>
        <button
          onClick={() => setSection("never")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${section === "never" ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          <UserX className="h-3.5 w-3.5" />
          Never Logged In
          {data && data.neverLoggedIn.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-xs leading-none">{data.neverLoggedIn.length}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
          {section === "payments" ? <AlertTriangle className="h-8 w-8 opacity-40" /> : <UserX className="h-8 w-8 opacity-40" />}
          <p>{section === "payments" ? "No failed payment accounts" : "No inactive signups"}</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account</th>
                  {section === "payments" && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan / Amount</th>}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Signed Up</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Login</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.companyName}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </td>
                    {section === "payments" && (
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">{item.planLabel ?? "—"}</div>
                        {item.amount && <div className="text-xs text-muted-foreground">${item.amount.toLocaleString()}/mo</div>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.lastLoginAt ? formatDistanceToNow(new Date(item.lastLoginAt), { addSuffix: true }) : <span className="text-orange-500">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={sendingId === item.id}
                        onClick={() => sendEmail(item, section === "payments" ? "payment" : "onboard")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        <Mail className="h-3 w-3" />
                        {sendingId === item.id ? "Sending..." : section === "payments" ? "Payment Reminder" : "Welcome Email"}
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
