import * as React from "react";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Banknote, Clock, Shield, CheckCircle2, AlertCircle, Loader2,
  ArrowLeft, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type SetupStatus = "NOT_SETUP" | "PENDING" | "ACTIVE" | "RESTRICTED" | "loading" | "auto-redirecting";

export default function PaymentSetupPage() {
  usePageTitle("Get Paid — Set Up Payment Account");
  const { data: user } = useGetMe();
  const [status, setStatus] = React.useState<SetupStatus>("loading");
  const [actionLoading, setActionLoading] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    if (user.role !== "SUB") { setStatus("NOT_SETUP"); return; }
    let cancelled = false;
    fetch(`${BASE}/api/stripe/connect/check-status`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        // Part 5 — Refresh URL Handler: if account exists but onboarding wasn't completed,
        // automatically generate a fresh Stripe link and redirect the sub seamlessly.
        if (d.status === "PENDING" && d.onboardingComplete === false) {
          setStatus("auto-redirecting");
          fetch(`${BASE}/api/stripe/connect/create-account`, { method: "POST", credentials: "include" })
            .then(r => r.json())
            .then(link => {
              if (cancelled) return;
              if (link.url) { window.location.href = link.url; }
              else { setStatus("PENDING"); }
            })
            .catch(() => { if (!cancelled) setStatus("PENDING"); });
        } else {
          setStatus(d.status ?? "NOT_SETUP");
        }
      })
      .catch(() => { if (!cancelled) setStatus("NOT_SETUP"); });
    return () => { cancelled = true; };
  }, [user]);

  const handleSetup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/api/stripe/connect/create-account`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      toast.error(data.error ?? "Could not start setup");
    } catch { toast.error("Could not start setup"); }
    finally { setActionLoading(false); }
  };

  const handleCheckStatus = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/api/stripe/connect/check-status`, { credentials: "include" });
      const data = await res.json();
      setStatus(data.status ?? "NOT_SETUP");
      if (data.status === "ACTIVE") toast.success("Your payment account is now active!");
      else toast("Status updated — it may still be processing.", { icon: "ℹ️" });
    } catch { toast.error("Could not check status"); }
    finally { setActionLoading(false); }
  };

  if (!user) return null;

  if (user.role !== "SUB") {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-16 px-4 text-center space-y-4">
          <h1 className="text-2xl font-bold">This page is for subcontractors</h1>
          <p className="text-muted-foreground">GC accounts manage payments from the subcontract page.</p>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2 min-h-[44px]"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Loading / Auto-redirecting */}
        {(status === "loading" || status === "auto-redirecting") && (
          <div className="flex flex-col items-center gap-4 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            {status === "auto-redirecting" && (
              <p className="text-sm">Resuming your Stripe setup — redirecting you now…</p>
            )}
          </div>
        )}

        {/* ── NOT_SETUP — Full landing page ─────────────────────────────── */}
        {status === "NOT_SETUP" && (
          <div className="space-y-10">
            {/* Header */}
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-5">
                <Banknote className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold font-display tracking-tight">Get Paid Directly to Your Bank</h1>
              <p className="text-muted-foreground mt-3 text-base max-w-md mx-auto leading-relaxed">
                Set up your payment account once and every GC payment goes straight to your bank automatically.
              </p>
            </div>

            {/* 3 Benefit cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center text-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-sm">Direct Deposit</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Money deposited directly into your bank account. No checks. No waiting.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center text-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-sm">2 Business Days</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">ACH payments arrive in your bank within 2 business days of GC approval.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center text-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="font-bold text-sm">Bank-Level Security</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Your bank details are handled entirely by Stripe. SubTracker never sees or stores them.</p>
                </div>
              </div>
            </div>

            {/* Step indicator */}
            <div className="rounded-2xl border border-border bg-muted/30 p-6 space-y-4">
              <p className="text-sm font-semibold text-center text-foreground">Here's how it works</p>
              <div className="space-y-3">
                {[
                  { n: 1, label: "Enter your personal information" },
                  { n: 2, label: "Enter your business information" },
                  { n: 3, label: "Connect your bank account" },
                ].map(step => (
                  <div key={step.n} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary-foreground">{step.n}</span>
                    </div>
                    <p className="text-sm text-foreground">{step.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center pt-1">
                All three steps happen on the secure Stripe page — not on SubTracker.
              </p>
            </div>

            {/* CTA */}
            <div className="space-y-4">
              <Button
                className="w-full min-h-[56px] text-base font-semibold gap-2"
                isLoading={actionLoading}
                onClick={handleSetup}
              >
                Get Started — Set Up Payment Account
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Powered by Stripe — the same secure payment infrastructure used by Amazon, Shopify, and millions of businesses worldwide.
              </p>
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 bg-card">
                  <svg viewBox="0 0 60 25" className="h-3.5 w-auto" aria-label="Stripe" role="img">
                    <path fill="#635BFF" d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.23c0-1.85-1.07-2.58-2.06-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.87zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.1h-3.13v5.85zm-4.91.7c0 2.97-2.31 4.66-5.73 4.66a11.2 11.2 0 0 1-4.46-.93v-3.93c1.38.75 3.1 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.26 13.77 0 14.51 0 9.95 0 7.04 2.28 5.3 5.6 5.3c1.36 0 2.72.2 4.01.7v3.92C8.56 9.31 7.2 8.9 5.9 8.9c-.87 0-1.44.25-1.44.9 0 1.85 6.29.97 6.29 5.85z" />
                  </svg>
                  <span className="text-xs font-semibold text-muted-foreground">Secured by Stripe</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PENDING (onboarding complete, Stripe reviewing) ─────────────── */}
        {status === "PENDING" && (
          <div className="max-w-lg mx-auto text-center space-y-6 py-10">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-100 dark:bg-yellow-950/30 mb-2">
              <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold">Verification in Progress</h1>
            <p className="text-muted-foreground">
              Stripe is reviewing your information. This usually takes 1–2 business days. We'll notify you when your account is active.
            </p>
            <Button variant="outline" className="gap-2 min-h-[44px]" isLoading={actionLoading} onClick={handleCheckStatus}>
              <RefreshCw className="h-4 w-4" /> Check Status
            </Button>
            <div className="pt-2">
              <Link href="/account">
                <Button variant="ghost" className="gap-2 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back to Account Settings
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── ACTIVE ─────────────────────────────────────────────────────── */}
        {status === "ACTIVE" && (
          <div className="max-w-lg mx-auto text-center space-y-6 py-10">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-950/30 mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold">You're All Set!</h1>
            <p className="text-muted-foreground">
              Your payment account is active. GCs can now pay you directly to your bank account. Payments arrive within 2 business days.
            </p>
            <Button variant="outline" className="gap-2 min-h-[44px]" isLoading={actionLoading} onClick={handleSetup}>
              Update Bank Account
            </Button>
            <div className="pt-2">
              <Link href="/account">
                <Button variant="ghost" className="gap-2 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back to Account Settings
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── RESTRICTED ─────────────────────────────────────────────────── */}
        {status === "RESTRICTED" && (
          <div className="max-w-lg mx-auto text-center space-y-6 py-10">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/30 mb-2">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold">Action Required</h1>
            <p className="text-muted-foreground">
              Stripe needs additional information to verify your account. Click below to complete verification and start receiving payments.
            </p>
            <Button className="gap-2 min-h-[44px] bg-red-600 hover:bg-red-700 text-white" isLoading={actionLoading} onClick={handleSetup}>
              Complete Verification
            </Button>
            <div className="pt-2">
              <Link href="/account">
                <Button variant="ghost" className="gap-2 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back to Account Settings
                </Button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
