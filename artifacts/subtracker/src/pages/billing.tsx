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
  formatSubscriptionStatus,
} from "@/lib/stripe";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CreditCard, Calendar, CheckCircle2, AlertCircle, Loader2,
  Receipt, Zap, RefreshCw, XCircle, ArrowUpRight,
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
      toast.success("Subscription activated! Welcome to SubTracker Pro.");
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

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const url = await startCheckout();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setUpgradeLoading(false);
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
  const isPastDue = sub?.status === "past_due";
  const isCanceled = !sub || sub.status === "canceled";

  const statusInfo = sub ? formatSubscriptionStatus(sub.status) : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your SubTracker Pro subscription</p>
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
                {isCanceled ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                        <Zap className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Free Plan</div>
                        <div className="text-sm text-muted-foreground">1 project included</div>
                      </div>
                      <Badge variant="secondary" className="ml-auto">Free</Badge>
                    </div>

                    {isPastDue && (
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-orange-800 text-sm">Payment Past Due</div>
                          <div className="text-xs text-orange-700 mt-0.5">
                            Your payment failed. You have a 3-day grace period before new project creation is locked.
                            Please update your payment method.
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border-2 border-primary bg-primary/5 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-foreground">SubTracker Pro</div>
                          <div className="text-sm text-muted-foreground">Unlimited everything</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">$49</div>
                          <div className="text-xs text-muted-foreground">/month</div>
                        </div>
                      </div>
                      <ul className="space-y-1.5 mb-4">
                        {["Unlimited projects", "Unlimited subcontractors", "Invoice PDF generation",
                          "Payment tracking and confirmation", "Priority support"].map(b => (
                          <li key={b} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <Button className="w-full" onClick={handleUpgrade} disabled={upgradeLoading}>
                        {upgradeLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirecting...</> : <><Zap className="h-4 w-4 mr-2" /> Upgrade to Pro — $49/month</>}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">SubTracker Pro</div>
                        <div className="text-sm text-muted-foreground">Unlimited projects & subcontractors</div>
                      </div>
                      <Badge
                        className={`ml-auto ${isActive && !isCancelAtPeriodEnd ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}
                        variant="outline"
                      >
                        {isCancelAtPeriodEnd ? "Cancelling" : statusInfo?.label ?? sub?.status}
                      </Badge>
                    </div>

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
                          <CreditCard className="h-3 w-3" /> Amount
                        </div>
                        <div className="font-semibold text-sm">$49.00 / month</div>
                      </div>
                    </div>

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
                            {inv.description || "SubTracker Pro"}
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
