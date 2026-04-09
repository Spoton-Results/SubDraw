import * as React from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Loader2, Building2, Mail, CreditCard, Clock, CheckCircle, XCircle,
  BarChart2, FileText, Receipt, TrendingUp, FileCheck, DollarSign, RefreshCw, Save, User
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

const PLAN_OPTIONS = [
  { value: "", label: "Clear override (use Stripe)" },
  { value: "SubTracker Starter", label: "Starter ($149/mo)" },
  { value: "SubTracker Growth", label: "Growth ($299/mo)" },
  { value: "SubTracker Scale", label: "Scale ($499/mo)" },
  { value: "SubTracker Enterprise", label: "Enterprise ($999/mo)" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  trial:     { label: "Trial",     cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  past_due:  { label: "Past Due",  cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-muted-foreground dark:bg-muted dark:text-muted-foreground" },
};

const ACTION_LABELS: Record<string, string> = {
  INVOICE_SUBMITTED: "Invoice Submitted", INVOICE_APPROVED: "Invoice Approved",
  INVOICE_REJECTED: "Invoice Rejected", INVOICE_FLAGGED: "Invoice Flagged",
  CHANGE_ORDER_CREATED: "Change Order Created", CHANGE_ORDER_APPROVED: "Change Order Approved",
  PAYMENT_RECORDED: "Payment Recorded", PAYMENT_CONFIRMED: "Payment Confirmed",
  LIEN_WAIVER_SIGNED: "Lien Waiver Signed", SUBCONTRACT_CREATED: "Subcontract Created",
  PROJECT_CREATED: "Project Created",
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function AdminAccountDetail() {
  const [, params] = useRoute("/admin/accounts/:userId");
  const [, setLocation] = useLocation();
  const userId = params?.userId;

  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState("");
  const [planExpireDays, setPlanExpireDays] = React.useState("");
  const [extendDays, setExtendDays] = React.useState("7");
  const [extendReason, setExtendReason] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);
  const [impersonating, setImpersonating] = React.useState(false);
  const [emailSubject, setEmailSubject] = React.useState("");
  const [emailBody, setEmailBody] = React.useState("");
  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [showEmailForm, setShowEmailForm] = React.useState(false);

  const load = React.useCallback(() => {
    if (!userId) return;
    setLoading(true);
    api(`/accounts/${userId}`).then(r => r.json()).then(d => {
      setData(d);
      setNotes(d.adminNotes ?? "");
      setSelectedPlan(d.adminPlanOverride ?? "");
    }).catch(() => toast.error("Failed to load account")).finally(() => setLoading(false));
  }, [userId]);

  React.useEffect(() => { load(); }, [load]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api(`/accounts/${userId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      toast.success("Notes saved");
    } catch { toast.error("Failed to save notes"); }
    setSavingNotes(false);
  };

  const applyPlan = async () => {
    setActionLoading(true);
    try {
      const r = await api(`/gc/${userId}/edit-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: selectedPlan || null, expiresInDays: planExpireDays ? parseInt(planExpireDays) : null }),
      });
      if (r.ok) { toast.success("Plan updated"); load(); }
      else { const d = await r.json(); toast.error(d.error ?? "Failed to update plan"); }
    } catch { toast.error("Failed to update plan"); }
    setActionLoading(false);
  };

  const extendTrial = async () => {
    if (!extendReason.trim()) { toast.error("Reason required"); return; }
    setActionLoading(true);
    try {
      const r = await api(`/gc/${userId}/extend-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: parseInt(extendDays) }),
      });
      if (r.ok) { toast.success("Trial extended"); setExtendReason(""); load(); }
      else { const d = await r.json(); toast.error(d.error ?? "Failed to extend trial"); }
    } catch { toast.error("Failed to extend trial"); }
    setActionLoading(false);
  };

  const impersonate = async () => {
    setImpersonating(true);
    try {
      const r = await api(`/gc/${userId}/impersonate`, { method: "POST" });
      if (r.ok) {
        toast.success(`Now viewing as this account`);
        window.location.href = BASE;
      } else toast.error("Failed to impersonate");
    } catch { toast.error("Failed to impersonate"); }
    setImpersonating(false);
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) { toast.error("Subject and body required"); return; }
    setSendingEmail(true);
    try {
      const r = await api(`/gc/${userId}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailSubject, message: emailBody }),
      });
      if (r.ok) { toast.success("Email sent"); setShowEmailForm(false); setEmailSubject(""); setEmailBody(""); }
      else { const d = await r.json(); toast.error(d.error ?? "Failed to send email"); }
    } catch { toast.error("Failed to send email"); }
    setSendingEmail(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!data) return (
    <div className="p-8 text-center text-muted-foreground">Account not found</div>
  );

  const status = data.status ?? "cancelled";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.cancelled;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setLocation("/admin?tab=accounts")} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{data.companyName}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
            {data.adminPlanOverride && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Override: {data.planLabel}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{data.email}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={impersonate}
            disabled={impersonating}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            {impersonating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
            Impersonate
          </button>
          <button
            onClick={() => setShowEmailForm(!showEmailForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Mail className="h-3.5 w-3.5" /> Send Email
          </button>
        </div>
      </div>

      {/* Email Form */}
      {showEmailForm && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h3 className="font-semibold mb-3">Send Email to {data.companyName}</h3>
          <input
            value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
            placeholder="Subject" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <textarea
            value={emailBody} onChange={e => setEmailBody(e.target.value)}
            rows={4} placeholder="Message body..."
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowEmailForm(false)}>Cancel</Button>
            <Button size="sm" onClick={sendEmail} disabled={sendingEmail}>
              {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send
            </Button>
          </div>
        </div>
      )}

      {/* Account Header Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Signup Date</div>
          <div className="text-sm font-semibold mt-0.5">{format(new Date(data.createdAt), "MMM d, yyyy")}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Last Login</div>
          <div className="text-sm font-semibold mt-0.5">
            {data.lastLoginAt ? formatDistanceToNow(new Date(data.lastLoginAt)) + " ago" : "Never"}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Plan</div>
          <div className="text-sm font-semibold mt-0.5">{data.planLabel ?? (status === "trial" ? "Trial" : "None")}</div>
        </div>
        {data.trialDaysLeft !== null && (
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Trial Days Left</div>
            <div className={`text-sm font-semibold mt-0.5 ${data.trialDaysLeft <= 3 ? "text-red-500" : ""}`}>{data.trialDaysLeft}d</div>
          </div>
        )}
        {data.nextBillingDate && (
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Next Billing</div>
            <div className="text-sm font-semibold mt-0.5">{format(new Date(data.nextBillingDate), "MMM d, yyyy")}</div>
          </div>
        )}
      </div>

      {/* Revenue */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-base mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Revenue</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Monthly Revenue" value={`$${data.monthlyRevenue}`} />
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Revenue Paid" value={`$${data.totalRevenuePaid}`} />
          <StatCard icon={<BarChart2 className="h-4 w-4" />} label="Stripe Volume Processed" value={`$${Math.round(data.stripePaymentVolume ?? 0).toLocaleString()}`} />
        </div>
      </div>

      {/* Usage */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-base mb-4 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-primary" /> Usage</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Building2 className="h-4 w-4" />} label="Projects" value={data.totalProjects} />
          <StatCard icon={<FileText className="h-4 w-4" />} label="Subcontracts" value={data.totalSubcontracts} />
          <StatCard icon={<Receipt className="h-4 w-4" />} label="Invoices" value={data.totalInvoices} />
          <StatCard icon={<XCircle className="h-4 w-4" />} label="Invoices Flagged" value={data.totalInvoicesFlagged} />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Change Orders" value={data.totalChangeOrders} />
          <StatCard icon={<FileCheck className="h-4 w-4" />} label="Lien Waivers Signed" value={data.totalLienWaivers} />
        </div>
      </div>

      {/* Activation */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" /> Activation
          <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${data.activationComplete ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
            {data.activationComplete ? "Complete" : "Incomplete"}
          </span>
        </h2>
        <div className="space-y-2">
          {[
            { label: "Created first project", done: data.activationSteps?.hasProject },
            { label: "Added first subcontract", done: data.activationSteps?.hasSubcontract },
            { label: "Submitted first invoice", done: data.activationSteps?.hasInvoice },
          ].map(step => (
            <div key={step.label} className="flex items-center gap-2.5">
              {step.done
                ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />}
              <span className={`text-sm ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-base mb-4 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Activity Timeline (Last 20)</h2>
        {data.timeline?.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No activity recorded</div>
        ) : (
          <div className="space-y-2">
            {(data.timeline ?? []).map((t: any, i: number) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{ACTION_LABELS[t.type] ?? t.type}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0">
                  {t.createdAt ? formatDistanceToNow(new Date(t.createdAt)) + " ago" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Extend Trial */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Extend Trial</h2>
          <div className="flex gap-2 mb-2">
            {["7", "14", "30"].map(d => (
              <button key={d} onClick={() => setExtendDays(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${extendDays === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{d} days</button>
            ))}
          </div>
          <input
            value={extendReason} onChange={e => setExtendReason(e.target.value)}
            placeholder="Reason (required)" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button size="sm" onClick={extendTrial} disabled={actionLoading} className="w-full">
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Extend Trial
          </Button>
        </div>

        {/* Change Plan */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Change Plan</h2>
          <select
            value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {selectedPlan && (
            <input
              value={planExpireDays} onChange={e => setPlanExpireDays(e.target.value)}
              placeholder="Override expires in N days (optional)" type="number"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
          <Button size="sm" onClick={applyPlan} disabled={actionLoading} className="w-full">
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Apply Plan
          </Button>
        </div>
      </div>

      {/* Call Notes */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold text-base mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Call Notes</h2>
        {data.lastCallAt && (
          <div className="text-xs text-muted-foreground mb-2">Last called: {formatDistanceToNow(new Date(data.lastCallAt))} ago</div>
        )}
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          rows={5}
          placeholder="Private notes about this account — saved permanently..."
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-2"
        />
        <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="gap-2">
          {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Notes
        </Button>
      </div>
    </div>
  );
}
