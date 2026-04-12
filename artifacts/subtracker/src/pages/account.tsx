import * as React from "react";
import { Layout } from "@/components/layout";
import {
  useGetMe, useUpdateProfile, useChangePassword, getGetMeQueryKey
} from "@workspace/api-client-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, User, KeyRound, Building2, Lock, ClipboardList, Plus, Trash2, Save, Pencil, CreditCard, CheckCircle2, Clock, AlertCircle, RefreshCw, Bell, BellOff } from "lucide-react";
import toast from "react-hot-toast";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscriptionStatus,
} from "@/lib/notifications";

const TRADE_CATEGORIES = [
  "General", "Electrical", "Plumbing", "HVAC", "Framing", "Drywall",
  "Roofing", "Flooring", "Painting", "Concrete", "Masonry", "Insulation",
  "Windows and Doors", "Landscaping", "Other",
] as const;

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function Account() {
  usePageTitle("Account Settings");
  const { data: user } = useGetMe();
  const queryClient = useQueryClient();

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [companyName, setCompanyName] = React.useState(user?.companyName ?? "");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);

  const [setNewPwd, setSetNewPwd] = React.useState("");
  const [setConfirmPwd, setSetConfirmPwd] = React.useState("");
  const [showSetNew, setShowSetNew] = React.useState(false);
  const [setPasswordLoading, setSetPasswordLoading] = React.useState(false);

  React.useEffect(() => {
    if (user?.companyName) setCompanyName(user.companyName);
  }, [user?.companyName]);

  const hasPassword = (user as any)?.hasPassword ?? true;

  const [payNavStatus, setPayNavStatus] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (user?.role !== "SUB") return;
    fetch(`${BASE}/api/stripe/connect/check-status`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setPayNavStatus(d.status ?? null))
      .catch(() => {});
  }, [user?.role]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return toast.error("Company name cannot be empty");
    try {
      await updateProfile.mutateAsync({ data: { companyName: companyName.trim() } });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("Profile updated!");
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to update profile");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    try {
      await changePassword.mutateAsync({ data: { currentPassword, newPassword } });
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to change password");
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setNewPwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (setNewPwd !== setConfirmPwd) return toast.error("Passwords do not match");
    setSetPasswordLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: setNewPwd }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Failed to set password");
        return;
      }
      toast.success("Password set successfully! You can now log in with your email and password.");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSetNewPwd("");
      setSetConfirmPwd("");
    } catch {
      toast.error("Failed to set password. Please try again.");
    } finally {
      setSetPasswordLoading(false);
    }
  };

  // ── Scope Templates (GC only) ─────────────────────────────────────────────
  type ScopeTemplate = { id: string; tradeCategory: string; name: string; description: string; createdAt: string };
  const { data: scopeTemplates = [], refetch: refetchTemplates } = useQuery<ScopeTemplate[]>({
    queryKey: ["scope-templates"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/scope-templates`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: user?.role === "GC",
    staleTime: 0,
  });

  const [newTplTrade, setNewTplTrade] = React.useState<string>("Electrical");
  const [newTplName, setNewTplName] = React.useState("");
  const [newTplText, setNewTplText] = React.useState("");
  const [newTplSaving, setNewTplSaving] = React.useState(false);
  const [tplAddOpen, setTplAddOpen] = React.useState(false);
  const [editTplId, setEditTplId] = React.useState<string | null>(null);
  const [editTplText, setEditTplText] = React.useState("");
  const [editTplName, setEditTplName] = React.useState("");
  const [editTplSaving, setEditTplSaving] = React.useState(false);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTplName.trim() || !newTplText.trim()) return toast.error("Name and description required");
    setNewTplSaving(true);
    try {
      const res = await fetch(`${BASE}/api/scope-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tradeCategory: newTplTrade, name: newTplName.trim(), description: newTplText.trim() }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to save"); return; }
      await refetchTemplates();
      setNewTplName(""); setNewTplText(""); setTplAddOpen(false);
      toast.success("Template saved");
    } finally { setNewTplSaving(false); }
  };

  const handleUpdateTemplate = async (id: string) => {
    if (!editTplName.trim() || !editTplText.trim()) return toast.error("Name and description required");
    setEditTplSaving(true);
    try {
      const res = await fetch(`${BASE}/api/scope-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editTplName.trim(), description: editTplText.trim() }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to update"); return; }
      await refetchTemplates();
      setEditTplId(null);
      toast.success("Template updated");
    } finally { setEditTplSaving(false); }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`${BASE}/api/scope-templates/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { toast.error("Failed to delete"); return; }
      await refetchTemplates();
      toast.success("Template deleted");
    } catch { toast.error("Failed to delete"); }
  };
  // ──────────────────────────────────────────────────────────────────────────

  if (!user) return null;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-display tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and security settings</p>
      </div>

      {/* Quick-nav for SUB users */}
      {user.role === "SUB" && (
        <div className="flex gap-1 mb-6 border-b">
          {[
            { href: "#profile", label: "Profile" },
            { href: "#security", label: "Security" },
            { href: "#payment", label: "Get Paid", dot: payNavStatus === "NOT_SETUP" },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
              {item.dot && (
                <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
              )}
            </a>
          ))}
        </div>
      )}

      <div className="max-w-2xl space-y-8">
        {/* PROFILE INFO CARD */}
        <div id="profile" className="scroll-mt-20">
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl border border-border/50">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {user.companyName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold">{user.companyName}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant={user.role === "GC" ? "default" : "secondary"} className="ml-auto">
                {user.role}
              </Badge>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" /> Company Name
                </label>
                <Input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block text-muted-foreground">Email address</label>
                <Input value={user.email} disabled className="bg-muted/50 text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  isLoading={updateProfile.isPending}
                  disabled={companyName === user.companyName}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>

        {/* SECURITY SECTION */}
        <div id="security" className="scroll-mt-20 space-y-8">
        {/* SET PASSWORD CARD — shown for magic-link-only users */}
        {!hasPassword && (
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> Set a Password
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                You currently log in via magic link. Set a password if you prefer traditional login.
              </p>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">New password</label>
                  <div className="relative">
                    <Input
                      type={showSetNew ? "text" : "password"}
                      required
                      placeholder="At least 8 characters"
                      value={setNewPwd}
                      onChange={e => setSetNewPwd(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSetNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Confirm new password</label>
                  <Input
                    type="password"
                    required
                    placeholder="Repeat your new password"
                    value={setConfirmPwd}
                    onChange={e => setSetConfirmPwd(e.target.value)}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" isLoading={setPasswordLoading} className="w-full sm:w-auto min-h-[44px]">
                    Set Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* CHANGE PASSWORD CARD — shown for users who already have a password */}
        {hasPassword && (
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Current password</label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      required
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">New password</label>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      required
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Confirm new password</label>
                  <Input
                    type="password"
                    required
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" isLoading={changePassword.isPending} className="w-full sm:w-auto min-h-[44px]">
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        </div>

        {/* MY SCOPE TEMPLATES — GC only */}
        {user.role === "GC" && (
          <Card>
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" /> My Scope of Work Templates
                </CardTitle>
                {!tplAddOpen && (
                  <Button size="sm" variant="outline" className="gap-1.5 min-h-[36px]" onClick={() => setTplAddOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> New Template
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Save reusable scope descriptions for any trade. Use them to quickly fill in Trade Scope of Work on any project during the BIDDING phase.
              </p>

              {/* Add new template form */}
              {tplAddOpen && (
                <form onSubmit={handleCreateTemplate} className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <label className="text-xs font-semibold mb-1 block">Trade</label>
                      <select
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={newTplTrade}
                        onChange={e => setNewTplTrade(e.target.value)}
                      >
                        {TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex-[2] min-w-[180px]">
                      <label className="text-xs font-semibold mb-1 block">Template Name</label>
                      <Input
                        required
                        placeholder="e.g. Standard Electrical SOW"
                        value={newTplName}
                        onChange={e => setNewTplName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Scope Description</label>
                    <textarea
                      required
                      className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none min-h-[120px]"
                      placeholder="Describe the full scope of work for this trade…"
                      value={newTplText}
                      onChange={e => setNewTplText(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setTplAddOpen(false); setNewTplName(""); setNewTplText(""); }}>Cancel</Button>
                    <Button type="submit" size="sm" isLoading={newTplSaving} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save Template
                    </Button>
                  </div>
                </form>
              )}

              {/* Template list */}
              {scopeTemplates.length === 0 && !tplAddOpen && (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No templates yet</p>
                  <p className="text-xs mt-1">Create your first scope template to reuse across projects.</p>
                </div>
              )}
              {scopeTemplates.length > 0 && (
                <div className="space-y-3">
                  {scopeTemplates.map(tpl => (
                    <div key={tpl.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                      {editTplId === tpl.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold mb-1 block">Template Name</label>
                            <Input value={editTplName} onChange={e => setEditTplName(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-semibold mb-1 block">Scope Description</label>
                            <textarea
                              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none min-h-[100px]"
                              value={editTplText}
                              onChange={e => setEditTplText(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditTplId(null)}>Cancel</Button>
                            <Button size="sm" isLoading={editTplSaving} onClick={() => handleUpdateTemplate(tpl.id)} className="gap-1.5">
                              <Save className="h-3.5 w-3.5" /> Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{tpl.name}</span>
                              <Badge variant="secondary" className="text-xs">{tpl.tradeCategory}</Badge>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => { setEditTplId(tpl.id); setEditTplName(tpl.name); setEditTplText(tpl.description); }}
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                                onClick={() => handleDeleteTemplate(tpl.id)}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-4">{tpl.description}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {/* GET PAID SETUP — SUB only */}
        {user.role === "SUB" && (
          <div id="payment" className="scroll-mt-20">
            <GetPaidSetupSection onStatusChange={setPayNavStatus} />
          </div>
        )}

        {/* NOTIFICATION SETTINGS */}
        <div id="notifications" className="scroll-mt-20">
          <NotificationSettingsSection role={user.role as string} />
        </div>
      </div>
    </Layout>
  );
}

function NotificationSettingsSection({ role }: { role: string }) {
  const [pushStatus, setPushStatus] = React.useState<"granted" | "denied" | "default" | "unsupported" | "loading">("loading");
  const [pushLoading, setPushLoading] = React.useState(false);

  const { data: prefs, refetch: refetchPrefs } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });

  const updatePrefs = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => refetchPrefs(),
    onError: () => toast.error("Failed to update notification preference"),
  });

  React.useEffect(() => {
    getPushSubscriptionStatus().then(s => setPushStatus(s));
  }, []);

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushStatus === "granted") {
        await unsubscribeFromPush();
        setPushStatus("default");
        toast.success("Push notifications disabled");
      } else {
        const ok = await subscribeToPush();
        if (ok) {
          setPushStatus("granted");
          toast.success("Push notifications enabled!");
        } else if (Notification.permission === "denied") {
          toast.error("Notifications blocked — enable them in your browser settings.");
        } else {
          toast.error("Could not enable push notifications.");
        }
      }
    } catch {
      toast.error("Could not change push notification status");
    } finally {
      setPushLoading(false);
    }
  };

  const gcPrefs = [
    { key: "invoiceSubmitted", label: "Invoice Submitted", desc: "When a sub submits an invoice for approval" },
    { key: "invoiceFlagged", label: "Invoice Flagged", desc: "When an invoice exceeds the contract balance" },
    { key: "changeOrderRequest", label: "Change Order Request", desc: "When a sub submits a change order for your review" },
    { key: "changeOrderApproved", label: "Change Order Approved by Sub", desc: "When a sub approves your change order" },
    { key: "changeOrderRejected", label: "Change Order Rejected by Sub", desc: "When a sub rejects your change order" },
    { key: "paymentConfirmed", label: "Payment Confirmed", desc: "When a sub confirms receipt of payment" },
    { key: "paymentDisputed", label: "Payment Disputed", desc: "When a sub disputes a payment" },
    { key: "insuranceExpiring", label: "Insurance Expiring", desc: "When a sub's insurance is expiring soon" },
    { key: "licenseExpiring", label: "License Expiring", desc: "When a sub's license is expiring soon" },
  ] as const;

  const subPrefs = [
    { key: "changeOrderCreated", label: "New Change Order", desc: "When your GC creates a change order for your approval" },
    { key: "invoiceApproved", label: "Invoice Approved", desc: "When your GC approves your invoice" },
    { key: "invoiceRejected", label: "Invoice Rejected", desc: "When your GC rejects your invoice" },
    { key: "paymentManual", label: "Payment Recorded", desc: "When your GC records a payment" },
    { key: "paymentStripe", label: "Stripe Payment Sent", desc: "When your GC sends a Stripe payment" },
    { key: "submittalReceived", label: "New Submittal", desc: "When your GC sends a new submittal" },
    { key: "insuranceExpiring", label: "Insurance Expiring", desc: "When your insurance certificate is expiring soon" },
    { key: "licenseExpiring", label: "License Expiring", desc: "When your contractor license is expiring soon" },
    { key: "paymentSetupReminder", label: "Payment Setup Reminders", desc: "Reminders to set up your Stripe payment account" },
  ] as const;

  const prefItems = role === "GC" ? gcPrefs : subPrefs;

  const PrefToggle = ({ prefKey, label, desc }: { prefKey: string; label: string; desc: string }) => {
    const enabled = prefs ? (prefs as any)[prefKey] !== false : true;
    return (
      <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-b-0">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <button
          onClick={() => updatePrefs.mutate({ [prefKey]: !enabled } as any)}
          disabled={updatePrefs.isPending}
          className={`relative h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5 ${enabled ? "bg-primary" : "bg-muted"}`}
          role="switch"
          aria-checked={enabled}
        >
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Notification Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Push Toggle */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h3 className="font-semibold text-sm text-foreground">Push Notifications</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pushStatus === "granted" && "Push notifications are enabled on this device."}
                {pushStatus === "denied" && "Push notifications are blocked. Enable them in your browser settings."}
                {pushStatus === "default" && "Enable push notifications to get real-time alerts."}
                {pushStatus === "unsupported" && "Your browser doesn't support push notifications."}
                {pushStatus === "loading" && "Checking status…"}
              </p>
            </div>
            {pushStatus !== "unsupported" && pushStatus !== "denied" && pushStatus !== "loading" && (
              <Button
                size="sm"
                variant={pushStatus === "granted" ? "outline" : "default"}
                onClick={handleTogglePush}
                disabled={pushLoading}
                className="shrink-0 gap-2 h-9"
              >
                {pushStatus === "granted" ? <><BellOff className="h-4 w-4" /> Disable</> : <><Bell className="h-4 w-4" /> Enable</>}
              </Button>
            )}
          </div>
          {pushStatus === "denied" && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
              To re-enable, click the lock icon in your browser's address bar and allow notifications for this site.
            </div>
          )}
        </div>

        {/* Per-type toggles */}
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-1">Notification Types</h3>
          <p className="text-xs text-muted-foreground mb-3">Control which in-app and push notifications you receive.</p>
          <div>
            {prefItems.map(item => (
              <PrefToggle key={item.key} prefKey={item.key} label={item.label} desc={item.desc} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GetPaidSetupSection({ onStatusChange }: { onStatusChange?: (status: string) => void }) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const [status, setStatus] = React.useState<"NOT_SETUP" | "PENDING" | "ACTIVE" | "RESTRICTED" | "loading">("loading");
  const [setupLoading, setSetupLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  const updateStatus = (s: string) => {
    setStatus(s as any);
    onStatusChange?.(s);
  };

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/stripe/connect/check-status`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (!cancelled) updateStatus(d.status ?? "NOT_SETUP"); })
      .catch(() => { if (!cancelled) updateStatus("NOT_SETUP"); });
    return () => { cancelled = true; };
  }, []);

  const handleSetup = async () => {
    setSetupLoading(true);
    try {
      const res = await fetch(`${BASE}/api/stripe/connect/create-account`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      toast.error(data.error ?? "Could not start setup");
    } catch { toast.error("Could not start setup"); }
    finally { setSetupLoading(false); }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${BASE}/api/stripe/connect/check-status`, { credentials: "include" });
      const data = await res.json();
      updateStatus(data.status ?? "NOT_SETUP");
      if (data.status === "ACTIVE") toast.success("Your payment account is now active!");
      else toast("Status updated. If you've completed verification, it may still be processing.", { icon: "ℹ️" });
    } catch { toast.error("Could not check status"); }
    finally { setChecking(false); }
  };

  if (status === "loading") return null;

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" /> Get Paid Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {status === "NOT_SETUP" && (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-base mb-1">Set Up to Receive Payments</h3>
              <ul className="space-y-2 mt-3">
                {["Get paid directly to your bank account", "ACH payments arrive in 2 business days", "Set up once and every future payment is automatic"].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <Button className="w-full min-h-[44px] gap-2" isLoading={setupLoading} onClick={handleSetup}>
              <CreditCard className="h-4 w-4" /> Set Up Payment Account
            </Button>
            <p className="text-xs text-muted-foreground text-center">Powered by Stripe — your bank details are encrypted and never stored by SubDraw.</p>
          </div>
        )}

        {status === "PENDING" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20 p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">Stripe is verifying your information</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">This usually takes 1 to 2 business days. We will notify you when your account is active.</p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="min-h-[44px] gap-2" isLoading={checking} onClick={handleCheckStatus}>
              <RefreshCw className="h-4 w-4" /> Check Status
            </Button>
          </div>
        )}

        {status === "ACTIVE" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <Badge className="bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400">Payment Account Active</Badge>
                <p className="text-sm text-muted-foreground mt-1">GCs can now pay you directly to your bank account.</p>
              </div>
            </div>
            <Button variant="outline" className="min-h-[44px] gap-2" isLoading={setupLoading} onClick={handleSetup}>
              <CreditCard className="h-4 w-4" /> Update Bank Account
            </Button>
          </div>
        )}

        {status === "RESTRICTED" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Stripe needs more information</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">Your account needs additional verification to receive payments.</p>
                </div>
              </div>
            </div>
            <Button className="min-h-[44px] gap-2 bg-red-600 hover:bg-red-700 text-white" isLoading={setupLoading} onClick={handleSetup}>
              Complete Verification
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
