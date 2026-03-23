import * as React from "react";
import { Mail, Send, Users, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

const SEGMENTS = [
  { value: "all_trials",   label: "All Active Trials",       desc: "Accounts currently in their trial period" },
  { value: "all_paying",   label: "All Paying Customers",    desc: "Accounts with an active subscription" },
  { value: "all_churned",  label: "Churned / Expired",       desc: "Accounts whose trial expired without subscribing" },
  { value: "all_annual",   label: "Annual Subscribers",      desc: "Accounts on annual billing" },
  { value: "all_users",    label: "Everyone",                desc: "All GC accounts (use carefully)" },
];

interface BroadcastResult {
  sent: number;
  segment: string;
  recipientCount: number;
}

export function TabEmailTools() {
  const [segment, setSegment] = React.useState("all_trials");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<BroadcastResult | null>(null);
  const [confirm, setConfirm] = React.useState(false);

  const selectedSeg = SEGMENTS.find(s => s.value === segment);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setSending(true);
    setConfirm(false);
    try {
      const r = await api("/broadcast-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, subject, message }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      setLastResult(data);
      toast.success(`Email sent to ${data.sent} account${data.sent !== 1 ? "s" : ""}`);
      setSubject("");
      setMessage("");
    } catch (e: any) {
      toast.error(e.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Email Tools</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Broadcast emails to customer segments</p>
      </div>

      {lastResult && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-start gap-3">
          <Mail className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-green-600 dark:text-green-400">Broadcast sent successfully</span>
            <p className="text-muted-foreground mt-0.5">Delivered to {lastResult.sent} recipient{lastResult.sent !== 1 ? "s" : ""} in the "{SEGMENTS.find(s => s.value === lastResult.segment)?.label}" segment.</p>
          </div>
          <button onClick={() => setLastResult(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs">Dismiss</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        {/* Segment selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Recipient Segment</label>
          <div className="grid grid-cols-1 gap-2">
            {SEGMENTS.map(s => (
              <label
                key={s.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${segment === s.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
              >
                <input type="radio" name="segment" value={s.value} checked={segment === s.value} onChange={() => { setSegment(s.value); setConfirm(false); }} className="mt-0.5 accent-primary" />
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Subject Line</label>
          <input
            type="text"
            value={subject}
            onChange={e => { setSubject(e.target.value); setConfirm(false); }}
            placeholder="Enter email subject..."
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Message Body</label>
          <textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setConfirm(false); }}
            placeholder="Write your message here (plain text)..."
            rows={8}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono"
          />
        </div>

        {/* Confirm + Send */}
        {confirm ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Confirm broadcast</p>
            <p className="text-xs text-muted-foreground">
              You're about to send this email to <strong>{selectedSeg?.label}</strong>. This cannot be undone. Make sure your subject and message are correct.
            </p>
            <div className="flex gap-2">
              <button onClick={handleSend} disabled={sending} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                <Send className="h-3.5 w-3.5" />
                {sending ? "Sending..." : "Confirm & Send"}
              </button>
              <button onClick={() => setConfirm(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleSend}
            disabled={!subject.trim() || !message.trim() || sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send to {selectedSeg?.label}
          </button>
        )}
      </div>

      {/* Tips */}
      <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 border border-border rounded-xl p-4">
        <p className="font-medium text-foreground">Tips</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Emails come from your configured email address and reference SubTracker.</li>
          <li>Keep messages concise — plain text works best for deliverability.</li>
          <li>Always review the recipient segment before sending.</li>
          <li>Use the "All Active Trials" segment for trial-to-paid conversion campaigns.</li>
        </ul>
      </div>
    </div>
  );
}
