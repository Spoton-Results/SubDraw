import * as React from "react";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetMe } from "@workspace/api-client-react";
import {
  getBilling,
  cancelSubscription,
  reactivateSubscription,
  startCheckout,
  startAnnualCheckout,
  upgradePlan,
  switchBillingInterval,
  formatSubscriptionStatus,
  formatPlanPrice,
} from "@/lib/stripe";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CreditCard, Calendar, CheckCircle2, AlertCircle, Loader2, Info,
  Receipt, Zap, RefreshCw, XCircle, ArrowUpRight, TrendingUp, Rocket, BarChart3,
  Building2, Star, Infinity, ChevronDown, ChevronUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

function formatCurrency(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(ts * 1000));
}

function formatDateStr(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(iso));
}

// ── Plan definitions (mirror of backend PLANS) ────────────────────────────────

const PLANS = [
  {
    name: "SubTracker Starter",
    label: "Starter",
    tagline: "Just Getting Started",
    monthlyUsd: 19900,
    annualUsd: 218900,
    annualMonthlyEquiv: 18242, // 218900 / 12 rounded
    annualSavings: 19900,
    limit: 10,
    icon: Zap,
    color: "border-border",
    headerColor: "text-blue-600",
    bgColor: "",
    popular: false,
  },
  {
    name: "SubTracker Growth",
    label: "Growth",
    tagline: "One Job at a Time",
    monthlyUsd: 29900,
    annualUsd: 328900,
    annualMonthlyEquiv: 27408,
    annualSavings: 29900,
    limit: 20,
    icon: TrendingUp,
    color: "border-border",
    headerColor: "text-primary",
    bgColor: "",
    popular: false,
  },
  {
    name: "SubTracker Scale",
    label: "Scale",
    tagline: "Most Popular",
    monthlyUsd: 39900,
    annualUsd: 438900,
    annualMonthlyEquiv: 36575,
    annualSavings: 39900,
    limit: 40,
    icon: Rocket,
    color: "border-primary ring-2 ring-primary",
    headerColor: "text-primary",
    bgColor: "bg-primary/5",
    popular: true,
  },
  {
    name: "SubTracker Enterprise",
    label: "Enterprise",
    tagline: "Multiple Crews Multiple Jobs",
    monthlyUsd: 69900,
    annualUsd: 768900,
    annualMonthlyEquiv: 64075,
    annualSavings: 69900,
    limit: null,
    icon: Building2,
    color: "border-border",
    headerColor: "text-violet-600",
    bgColor: "",
    popular: false,
  },
];

const COMPARISON_FEATURES = [
  { label: "Active Subcontracts", values: ["10", "20", "40", "Unlimited"] },
  { label: "Projects", values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Invoice Management", values: [true, true, true, true] },
  { label: "Change Orders", values: [true, true, true, true] },
  { label: "Lien Waivers", values: [true, true, true, true] },
  { label: "Compliance Tracking", values: [true, true, true, true] },
  { label: "AI Bid Intelligence", values: [true, true, true, true] },
  { label: "Subcontractors", values: ["Free", "Free", "Free", "Free"] },
];

const MODEL_CHANGE_BANNER_KEY = "subtracker_model_change_v1_dismissed";

export default function Billing() {
  usePageTitle("Billing");
  const { data: user } = useGetMe();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const checkoutSuccess = searchParams.get("success") === "1";
  const checkoutCancelled = searchParams.get("cancelled") === "1";

  const [billingMode, setBillingMode] = React.useState<"monthly" | "annual">("monthly");
  const [calcProjects, setCalcProjects] = React.useState("");
  const [calcSubsPerProject, setCalcSubsPerProject] = React.useState("");
  const [showComparison, setShowComparison] = React.useState(false);
  const [modelBannerDismissed, setModelBannerDismissed] = React.useState(
    typeof window !== "undefined" ? !!localStorage.getItem(MODEL_CHANGE_BANNER_KEY) : false
  );
  const [intervalSwitching, setIntervalSwitching] = React.useState(false);

  const dismissModelBanner = () => {
    localStorage.setItem(MODEL_CHANGE_BANNER_KEY, "1");
    setModelBannerDismissed(true);
  };

  React.useEffect(() => {
    if (checkoutSuccess) {
      toast.success("Subscription activated! Welcome to SubTracker.");
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    }
    if (checkoutCancelled) {
      toast("Checkout was cancelled.", { icon: "ℹ️" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkoutSuccess, checkoutCancelled]);

  const { data: billing, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: getBilling,
    enabled: user?.role === "GC",
  });

  const [upgradeLoading, setUpgradeLoading] = React.useState(false);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = React.useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = React.useState(false);

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      toast.success("Subscription will be cancelled at the end of the billing period.");
      setCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to cancel"),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateSubscription,
    onSuccess: () => {
      toast.success("Subscription reactivated!");
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to reactivate"),
  });

  const handleUpgrade = async (nextPlanName: string) => {
    setUpgradeLoading(true);
    try {
      await upgradePlan(nextPlanName);
      toast.success(`Upgraded to ${nextPlanName.replace("SubTracker ", "")}!`);
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    } catch (err: any) {
      toast.error(err.message || "Upgrade failed");
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleNewCheckout = async (planName: string) => {
    setCheckoutLoadingPlan(planName);
    try {
      const url = billingMode === "annual"
        ? await startAnnualCheckout(planName)
        : await startCheckout(planName);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setCheckoutLoadingPlan(null);
    }
  };

  const handleSwitchInterval = async (interval: "month" | "year") => {
    setIntervalSwitching(true);
    try {
      await switchBillingInterval(interval);
      toast.success(interval === "year" ? "Switched to annual billing — saving one month per year!" : "Switched to monthly billing.");
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to switch billing interval");
    } finally {
      setIntervalSwitching(false);
    }
  };

  // Calculator
  const calcTotal = (() => {
    const p = parseInt(calcProjects) || 0;
    const s = parseInt(calcSubsPerProject) || 0;
    return p * s;
  })();
  const recommendedPlan = calcTotal === 0 ? null
    : calcTotal <= 10 ? "SubTracker Starter"
    : calcTotal <= 20 ? "SubTracker Growth"
    : calcTotal <= 40 ? "SubTracker Scale"
    : "SubTracker Enterprise";

  if (user?.role !== "GC") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-muted-foreground">Billing is only available for General Contractors.</p>
        </div>
      </Layout>
    );
  }

  const sub = billing?.subscription;
  const invoices = billing?.invoices ?? [];
  const isActive = sub && (sub.status === "active" || sub.status === "trialing");
  const isCancelAtPeriodEnd = sub?.cancel_at_period_end;
  const isPastDue = billing?.isPastDue ?? false;
  const isCanceled = !sub || sub.status === "canceled";
  const activeCount = billing?.activeCount ?? 0;
  const limit = billing?.limit ?? null;
  const planName = billing?.planName ?? null;
  const planLabel = billing?.planLabel ?? null;
  const nextPlan = billing?.nextPlan ?? null;
  const billingInterval = billing?.billingInterval ?? null;
  const statusInfo = sub ? formatSubscriptionStatus(sub.status) : null;
  const projectsBreakdown = billing?.projectsBreakdown ?? [];
  const nextChargeAmount = billing?.nextChargeAmount ?? null;
  const annualRenewsAt = billing?.annualRenewsAt ?? null;

  // Plan card used in both demo and no-sub views
  const PlanCards = ({ showCheckout }: { showCheckout: boolean }) => (
    <div className="space-y-6">
      {/* Monthly / Annual toggle */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
          <button
            onClick={() => setBillingMode("monthly")}
            className={cn("px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors", billingMode === "monthly" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingMode("annual")}
            className={cn("px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5", billingMode === "annual" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Annual
            <span className="text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Save 1 month</span>
          </button>
        </div>
        {billingMode === "annual" && (
          <p className="text-xs text-muted-foreground text-center">
            Pay annually and get one month completely free — same as getting SubTracker free every December.
          </p>
        )}
      </div>

      {/* Plan recommendation calculator */}
      <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Find your plan
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Active projects you manage</label>
            <input
              type="number"
              min="0"
              value={calcProjects}
              onChange={e => setCalcProjects(e.target.value)}
              placeholder="e.g. 3"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Subcontractors per project (avg)</label>
            <input
              type="number"
              min="0"
              value={calcSubsPerProject}
              onChange={e => setCalcSubsPerProject(e.target.value)}
              placeholder="e.g. 8"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        {calcTotal > 0 && (
          <div className="text-sm font-semibold text-foreground">
            Your estimated active subcontracts: <span className="text-primary">{calcTotal}</span>
            {recommendedPlan && (
              <span className="ml-2 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                → {PLANS.find(p => p.name === recommendedPlan)?.label} recommended
              </span>
            )}
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PLANS.map((plan, idx) => {
          const Icon = plan.icon;
          const isPopular = plan.popular;
          const isRecommended = recommendedPlan === plan.name && calcTotal > 0;
          const isLoadingThis = checkoutLoadingPlan === plan.name;
          const displayPrice = billingMode === "annual" ? plan.annualMonthlyEquiv : plan.monthlyUsd;

          return (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl border-2 p-4 flex flex-col gap-3 transition-shadow",
                plan.color,
                plan.bgColor,
                isPopular && "shadow-lg scale-[1.02]"
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" /> Most Popular
                  </span>
                </div>
              )}
              {isRecommended && (
                <div className={cn("absolute -top-3 z-10", isPopular ? "right-2" : "left-1/2 -translate-x-1/2")}>
                  <span className="bg-green-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">Recommended for You</span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                <Icon className={cn("h-4 w-4 shrink-0", plan.headerColor)} />
                <span className={cn("font-bold text-sm", plan.headerColor)}>{plan.label}</span>
              </div>
              <div className="text-xs text-muted-foreground -mt-2">{plan.tagline}</div>

              <div>
                <div className="text-2xl font-bold">{formatPlanPrice(displayPrice)}</div>
                <div className="text-xs text-muted-foreground">/month{billingMode === "annual" ? " equivalent" : ""}</div>
                {billingMode === "annual" && (
                  <>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatPlanPrice(plan.annualUsd)}/year billed annually
                    </div>
                    <Badge className="mt-1 text-xs bg-green-100 text-green-700 border-green-200 font-bold">1 Month Free</Badge>
                  </>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                {plan.limit === null
                  ? <span className="flex items-center gap-1"><Infinity className="h-3 w-3" /> Unlimited active subcontracts</span>
                  : `Up to ${plan.limit} active subcontracts`}
              </div>

              {showCheckout ? (
                <Button
                  size="sm"
                  variant={isPopular ? "default" : "outline"}
                  className="w-full mt-auto"
                  onClick={() => handleNewCheckout(plan.name)}
                  disabled={checkoutLoadingPlan !== null}
                >
                  {isLoadingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : "Select"}
                </Button>
              ) : (
                <a
                  href="/register"
                  className={cn("flex items-center justify-center text-xs font-semibold rounded-lg py-1.5 px-3 border transition-colors mt-auto", isPopular ? "bg-primary text-primary-foreground hover:opacity-90" : "border-input hover:bg-secondary")}
                >
                  Sign up free
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Scale callout */}
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 px-5 py-4 text-center">
        <p className="text-sm text-foreground font-medium">
          Most GCs pick Scale. At $399 a month you get up to 40 active subcontracts — enough for one to two full jobs running at the same time.{" "}
          <span className="font-semibold text-primary">If SubTracker catches one invoice overrun this month it pays for itself.</span>
        </p>
      </div>

      {/* Plan comparison table */}
      <div>
        <button
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
          onClick={() => setShowComparison(c => !c)}
        >
          {showComparison ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showComparison ? "Hide" : "Show"} plan comparison
        </button>
        {showComparison && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Feature</th>
                  {PLANS.map(p => (
                    <th key={p.name} className={cn("px-4 py-2.5 text-center font-bold text-xs", p.popular ? "text-primary" : "text-foreground")}>
                      {p.label}
                      {p.popular && <span className="ml-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Popular</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARISON_FEATURES.map(feat => (
                  <tr key={feat.label} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{feat.label}</td>
                    {feat.values.map((val, i) => (
                      <td key={i} className={cn("px-4 py-2.5 text-center text-xs", PLANS[i].popular ? "bg-primary/5" : "")}>
                        {val === true ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : val === false ? (
                          <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        ) : (
                          <span className={cn("font-semibold", i === 2 ? "text-primary" : "")}>{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your SubTracker subscription</p>
        </div>

        {/* One-time pricing model change banner for existing customers */}
        {!modelBannerDismissed && billing && planName && planName !== "Demo" && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-blue-800 dark:text-blue-300">
              <span className="font-semibold">We updated our pricing model.</span>{" "}
              SubTracker now tracks active subcontracts instead of projects. Your plan includes the subcontract limits shown below. Archive completed projects at any time to free up slots. No action needed unless you exceed your new limit.
            </div>
            <button onClick={dismissModelBanner} className="text-blue-600 hover:text-blue-800 text-xs font-semibold shrink-0">Dismiss</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* Current Plan Card */}
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                {billing?.planName === "Demo" ? (
                  /* ── Demo account ── */
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Demo Account</div>
                        <div className="text-sm text-muted-foreground">Sign up for a free 14-day trial to create your own projects</div>
                      </div>
                      <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-700">Demo</Badge>
                    </div>
                    <a
                      href="/register"
                      className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground font-semibold py-2.5 px-4 hover:opacity-90 transition-opacity text-sm"
                    >
                      Start your free 14-day trial <ArrowUpRight className="h-4 w-4" />
                    </a>
                    <p className="text-sm text-muted-foreground">Available plans after sign-up:</p>
                    <PlanCards showCheckout={false} />
                  </div>
                ) : isCanceled ? (
                  /* ── No subscription — show plan selector ── */
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                        <Zap className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        {billing?.trialActive ? (
                          <>
                            <div className="font-semibold text-foreground">Free Trial</div>
                            <div className="text-sm text-muted-foreground">
                              {billing.trialDaysLeft === 0 ? "Expires today" : billing.trialDaysLeft === 1 ? "1 day remaining" : `${billing.trialDaysLeft} days remaining`}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-foreground">No Active Plan</div>
                            <div className="text-sm text-muted-foreground">Free trial ended — choose a plan below</div>
                          </>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn("ml-auto", billing?.trialActive && (billing?.trialDaysLeft ?? 99) <= 4 ? "bg-orange-100 text-orange-700" : "")}
                      >
                        {billing?.trialActive ? `${billing.trialDaysLeft}d left` : "Expired"}
                      </Badge>
                    </div>

                    {isPastDue && (
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-orange-800 text-sm">Payment Past Due</div>
                          <div className="text-xs text-orange-700 mt-0.5">
                            Your payment failed. You have a 3-day grace period. Please update your payment method.
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">Choose a plan to manage more subcontracts:</p>
                    <PlanCards showCheckout={true} />
                  </div>
                ) : (
                  /* ── Active subscription ── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {planName === "SubTracker Enterprise" ? <Building2 className="h-5 w-5 text-violet-600" />
                          : planName === "SubTracker Scale" ? <Rocket className="h-5 w-5 text-primary" />
                          : planName === "SubTracker Growth" ? <TrendingUp className="h-5 w-5 text-primary" />
                          : <Zap className="h-5 w-5 text-blue-600" />}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{planLabel ?? "SubTracker"} Plan</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>
                            {billingInterval === "year"
                              ? `${formatPlanPrice(PLANS.find(p => p.name === planName)?.annualUsd ?? 0)}/year`
                              : `${formatPlanPrice(PLANS.find(p => p.name === planName)?.monthlyUsd ?? (sub?.items?.data?.[0]?.price?.unit_amount ?? 0))}/month`}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {billingInterval === "year" ? "Annual billing" : "Monthly billing"}
                          </Badge>
                        </div>
                      </div>
                      <Badge
                        className={cn("ml-auto", isActive && !isCancelAtPeriodEnd ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200")}
                        variant="outline"
                      >
                        {isCancelAtPeriodEnd ? "Cancelling" : statusInfo?.label ?? sub?.status}
                      </Badge>
                    </div>

                    {/* Active subcontract usage */}
                    {limit !== null && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            Active subcontracts
                          </div>
                          <span className={cn("text-xs font-bold", activeCount >= limit ? "text-red-600" : activeCount >= limit - 5 ? "text-yellow-600" : "text-foreground")}>
                            {activeCount} of {limit}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={cn("h-2 rounded-full transition-all", activeCount >= limit ? "bg-red-500" : activeCount >= limit - 5 ? "bg-yellow-500" : "bg-primary")}
                            style={{ width: `${Math.min(100, (activeCount / limit) * 100)}%` }}
                          />
                        </div>
                        {activeCount >= limit && (
                          <p className="text-xs text-red-600 mt-1.5 font-medium">
                            Plan limit reached — upgrade or archive completed projects to free slots.
                          </p>
                        )}
                        {activeCount < limit && activeCount >= limit - 5 && (
                          <p className="text-xs text-yellow-600 mt-1.5">
                            Approaching your limit — consider upgrading soon.
                          </p>
                        )}
                      </div>
                    )}
                    {limit === null && (
                      <div className="rounded-xl bg-secondary/50 p-3 flex items-center gap-2">
                        <Infinity className="h-4 w-4 text-violet-600" />
                        <span className="text-sm font-medium">Unlimited active subcontracts</span>
                        <span className="text-xs text-muted-foreground ml-1">({activeCount} currently active)</span>
                      </div>
                    )}

                    {/* Project breakdown */}
                    {projectsBreakdown.length > 0 && (
                      <div className="rounded-xl bg-secondary/30 p-3 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Currently counting toward your limit:</div>
                        {projectsBreakdown.map(p => (
                          <div key={p.projectId} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground truncate pr-2">{p.projectName}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-[10px] py-0">
                                {p.status === "BIDDING" ? "Bidding" : "Construction"}
                              </Badge>
                              <span className="text-muted-foreground">{p.subcontractCount} sub{p.subcontractCount !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Billing details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {billingInterval === "year" ? "Annual renewal" : "Next billing date"}
                        </div>
                        <div className="font-semibold text-sm">
                          {annualRenewsAt ? formatDateStr(annualRenewsAt) : sub?.current_period_end ? formatDate(sub.current_period_end) : "—"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> Next charge
                        </div>
                        <div className="font-semibold text-sm">
                          {nextChargeAmount !== null ? formatCurrency(nextChargeAmount) : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Annual plan banner */}
                    {billingInterval === "year" && annualRenewsAt && (
                      <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-green-800 dark:text-green-300">
                          Annual plan active — renews on {formatDateStr(annualRenewsAt)}.
                        </span>
                      </div>
                    )}

                    {/* Billing interval switch */}
                    {isActive && !isCancelAtPeriodEnd && (
                      <div className="rounded-xl border border-border p-3 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="text-sm font-semibold">
                            {billingInterval === "year" ? "Switch to monthly billing" : "Switch to annual billing & save one month"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {billingInterval === "year"
                              ? "Your remaining annual days will be credited as a prorate."
                              : `Save ${formatPlanPrice(PLANS.find(p => p.name === planName)?.annualSavings ?? 0)} per year. Remaining days credited as prorate.`}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSwitchInterval(billingInterval === "year" ? "month" : "year")}
                          disabled={intervalSwitching}
                          className="shrink-0"
                        >
                          {intervalSwitching ? <Loader2 className="h-3 w-3 animate-spin" /> : billingInterval === "year" ? "Switch to Monthly" : "Switch to Annual & Save"}
                        </Button>
                      </div>
                    )}

                    {isCancelAtPeriodEnd && (
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-orange-800 text-sm">Subscription Cancelling</div>
                          <div className="text-xs text-orange-700 mt-0.5">
                            Your subscription will end on {formatDate(sub.current_period_end)}.
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reactivateMutation.mutate()}
                          disabled={reactivateMutation.isPending}
                          className="shrink-0 text-xs"
                        >
                          {reactivateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" /> Keep Plan</>}
                        </Button>
                      </div>
                    )}

                    {isPastDue && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-red-800 text-sm">Payment Failed</div>
                          <div className="text-xs text-red-700 mt-0.5">
                            Your last payment failed. You have a 3-day grace period before new subcontract creation is locked.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Upgrade to next tier */}
                    {nextPlan && isActive && !isCancelAtPeriodEnd && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-sm text-foreground">Upgrade to {nextPlan.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {nextPlan.limit === null ? "Unlimited" : `Up to ${nextPlan.limit}`} active subcontracts — {formatPlanPrice(nextPlan.monthlyUsd)}/month. Prorated difference charged immediately.
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleUpgrade(nextPlan.name)}
                          disabled={upgradeLoading}
                          className="shrink-0"
                        >
                          {upgradeLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
                          Upgrade
                        </Button>
                      </div>
                    )}

                    {isActive && !isCancelAtPeriodEnd && (
                      <div className="border-t pt-4">
                        {cancelConfirm ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                            <p className="text-sm text-red-800 font-medium">
                              Are you sure? Your subscription will remain active until {formatDate(sub.current_period_end)}, then revert to the free plan.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => cancelMutation.mutate()}
                                disabled={cancelMutation.isPending}
                              >
                                {cancelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                Yes, cancel
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setCancelConfirm(false)}>
                                Keep subscription
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCancelConfirm(true)}
                            className="text-sm text-destructive hover:underline"
                          >
                            Cancel Subscription
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Plan options for active subscribers wanting to change */}
            {isActive && !isCancelAtPeriodEnd && (
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-primary" />
                    All Plans
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <PlanCards showCheckout={false} />
                </CardContent>
              </Card>
            )}

            {/* Billing History */}
            {invoices.length > 0 && (
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Billing History
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="divide-y">
                    {invoices.map((inv: any) => (
                      <div key={inv.id} className="py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">
                            {inv.description || (planLabel ? `SubTracker ${planLabel}` : "SubTracker")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(inv.created)}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">
                          {formatCurrency(inv.amount_paid ?? inv.amount_due ?? 0, inv.currency ?? "usd")}
                        </div>
                        <Badge
                          variant="outline"
                          className={inv.status === "paid" ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}
                        >
                          {inv.status === "paid" ? "Paid" : inv.status}
                        </Badge>
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs flex items-center gap-1 shrink-0"
                          >
                            View <ArrowUpRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
