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
  upgradePlan,
  formatSubscriptionStatus,
  formatPlanPrice,
} from "@/lib/stripe";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CreditCard, Calendar, CheckCircle2, AlertCircle, Loader2,
  Receipt, Zap, RefreshCw, XCircle, ArrowUpRight, TrendingUp, Rocket, BarChart3,
} from "lucide-react";
import { useLocation } from "wouter";

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

const PLAN_ICONS: Record<string, React.ElementType> = {
  "SubTracker Starter": Zap,
  "SubTracker Growth": TrendingUp,
  "SubTracker Scale": Rocket,
};

const PLAN_COLORS: Record<string, string> = {
  "SubTracker Starter": "text-blue-600",
  "SubTracker Growth": "text-primary",
  "SubTracker Scale": "text-violet-600",
};

const UNSUBSCRIBED_PLANS = [
  { name: "SubTracker Starter", label: "Starter", monthlyUsd: 39900, limit: 5, icon: Zap, color: "border-blue-200", headerColor: "text-blue-700" },
  { name: "SubTracker Growth",  label: "Growth",  monthlyUsd: 79900, limit: 15, icon: TrendingUp, color: "border-primary ring-2 ring-primary", headerColor: "text-primary", popular: true },
  { name: "SubTracker Scale",   label: "Scale",   monthlyUsd: 149900, limit: 40, icon: Rocket, color: "border-violet-200", headerColor: "text-violet-700" },
];

export default function Billing() {
  usePageTitle("Billing");
  const { data: user } = useGetMe();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const checkoutSuccess = searchParams.get("success") === "1";
  const checkoutCancelled = searchParams.get("cancelled") === "1";

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
      toast.success(`Upgraded to ${nextPlanName.replace("SubTracker ", "")}! Your card has been charged the prorated difference.`);
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
      const url = await startCheckout(planName);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setCheckoutLoadingPlan(null);
    }
  };

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
  const statusInfo = sub ? formatSubscriptionStatus(sub.status) : null;
  const PlanIcon = planName ? (PLAN_ICONS[planName] ?? Zap) : Zap;
  const planColor = planName ? (PLAN_COLORS[planName] ?? "text-primary") : "text-muted-foreground";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your SubTracker subscription</p>
        </div>

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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {UNSUBSCRIBED_PLANS.map(plan => {
                        const Icon = plan.icon;
                        return (
                          <div key={plan.name} className={`relative rounded-2xl border-2 p-4 flex flex-col gap-3 ${plan.color}`}>
                            {(plan as any).popular && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">Popular</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${plan.headerColor}`} />
                              <span className={`font-bold text-sm ${plan.headerColor}`}>{plan.label}</span>
                            </div>
                            <div>
                              <div className="text-2xl font-bold">{formatPlanPrice(plan.monthlyUsd)}</div>
                              <div className="text-xs text-muted-foreground">/month</div>
                            </div>
                            <div className="text-xs text-muted-foreground">Up to {plan.limit} active projects</div>
                            <a
                              href="/register"
                              className={`flex items-center justify-center text-xs font-semibold rounded-lg py-1.5 px-3 border transition-colors ${(plan as any).popular ? "bg-primary text-primary-foreground hover:opacity-90" : "border-input hover:bg-secondary"}`}
                            >
                              Sign up free
                            </a>
                          </div>
                        );
                      })}
                    </div>
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
                              {billing.trialDaysLeft === 0
                                ? "Expires today"
                                : billing.trialDaysLeft === 1
                                ? "1 day remaining"
                                : `${billing.trialDaysLeft} days remaining`}
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
                        className={`ml-auto ${billing?.trialActive && (billing?.trialDaysLeft ?? 99) <= 4 ? "bg-orange-100 text-orange-700" : ""}`}
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
                            Your payment failed. You have a 3-day grace period before new project creation is locked. Please update your payment method.
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">Choose a plan to manage more projects:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {UNSUBSCRIBED_PLANS.map(plan => {
                        const Icon = plan.icon;
                        const isLoadingThis = checkoutLoadingPlan === plan.name;
                        return (
                          <div key={plan.name} className={`relative rounded-2xl border-2 p-4 flex flex-col gap-3 ${plan.color}`}>
                            {(plan as any).popular && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">Popular</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${plan.headerColor}`} />
                              <span className={`font-bold text-sm ${plan.headerColor}`}>{plan.label}</span>
                            </div>
                            <div>
                              <div className="text-2xl font-bold">{formatPlanPrice(plan.monthlyUsd)}</div>
                              <div className="text-xs text-muted-foreground">/month</div>
                            </div>
                            <div className="text-xs text-muted-foreground">Up to {plan.limit} active projects</div>
                            <Button
                              size="sm"
                              variant={(plan as any).popular ? "default" : "outline"}
                              className="w-full"
                              onClick={() => handleNewCheckout(plan.name)}
                              disabled={checkoutLoadingPlan !== null}
                            >
                              {isLoadingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : "Select"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ── Active subscription ── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center`}>
                        <PlanIcon className={`h-5 w-5 ${planColor}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{planLabel ?? "SubTracker"} Plan</div>
                        <div className="text-sm text-muted-foreground">
                          {formatPlanPrice(billing?.subscription ? (billing.subscription.items?.data?.[0]?.price?.unit_amount ?? 0) : 0)}/month
                        </div>
                      </div>
                      <Badge
                        className={`ml-auto ${isActive && !isCancelAtPeriodEnd ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}
                        variant="outline"
                      >
                        {isCancelAtPeriodEnd ? "Cancelling" : statusInfo?.label ?? sub?.status}
                      </Badge>
                    </div>

                    {/* Project usage bar */}
                    {limit !== null && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            Active projects
                          </div>
                          <span className={`text-xs font-bold ${activeCount >= limit ? "text-red-600" : "text-foreground"}`}>
                            {activeCount} of {limit}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${activeCount >= limit ? "bg-red-500" : activeCount >= limit * 0.8 ? "bg-orange-500" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, (activeCount / limit) * 100)}%` }}
                          />
                        </div>
                        {activeCount >= limit && (
                          <p className="text-xs text-red-600 mt-1.5 font-medium">
                            Plan limit reached — upgrade or mark a project Complete to free a slot.
                          </p>
                        )}
                      </div>
                    )}

                    {isCancelAtPeriodEnd && (
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="font-semibold text-orange-800 text-sm">Subscription Cancelling</div>
                          <div className="text-xs text-orange-700 mt-0.5">
                            Your subscription will end on {formatDate(sub.current_period_end)}. You'll revert to the free plan after that date.
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
                            Your last payment failed. Please update your payment method. You have a 3-day grace period before new project creation is locked.
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Next billing date
                        </div>
                        <div className="font-semibold text-sm">
                          {sub?.current_period_end ? formatDate(sub.current_period_end) : "—"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> Plan
                        </div>
                        <div className="font-semibold text-sm">{planLabel ?? "—"}</div>
                      </div>
                    </div>

                    {/* Upgrade to next tier */}
                    {nextPlan && isActive && !isCancelAtPeriodEnd && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-sm text-foreground">Upgrade to {nextPlan.label}</div>
                          <div className="text-xs text-muted-foreground">
                            Up to {nextPlan.limit} active projects — {formatPlanPrice(nextPlan.monthlyUsd)}/month. Prorated difference charged immediately.
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
                              Are you sure? Your subscription will remain active until {formatDate(sub.current_period_end)}, then revert to the free plan (1 project max).
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
                            {inv.description || planLabel ? `SubTracker ${planLabel}` : "SubTracker"}
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
                          className={inv.status === "paid"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-orange-50 text-orange-700 border-orange-200"}
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
