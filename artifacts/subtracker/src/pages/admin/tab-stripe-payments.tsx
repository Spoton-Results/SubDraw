import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CreditCard, CheckCircle2, Clock, AlertTriangle, DollarSign, TrendingUp, Users, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface AdminStats {
  totalAccounts: number;
  activeAccounts: number;
  pendingAccounts: number;
  totalVolumeThisMonth: number;
  successfulTransactions: number;
  failedTransactions: number;
  last20Transactions: {
    id: string;
    amount: number;
    stripePaymentIntentId: string | null;
    stripePaymentMethod: string | null;
    stripePaymentInitiatedAt: string | null;
    invoiceNumber: string;
    subcontractId: string;
    gcName: string;
    subName: string;
  }[];
}

function StatCard({ title, value, sub, icon, color }: { title: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0", color)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

export function AdminStripePaymentsTab() {
  const { data, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["admin-stripe-stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/stripe/connect/admin-stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Failed to load Stripe Payments stats.
      </div>
    );
  }

  const notSetupCount = data.totalAccounts === 0 ? 0 : 0;
  const setupRatio = data.activeAccounts + data.pendingAccounts > 0
    ? `${data.activeAccounts} active · ${data.pendingAccounts} pending`
    : "No subs have set up payments yet";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-display text-foreground mb-1">Stripe Payments Overview</h2>
        <p className="text-sm text-muted-foreground">Direct charges from GCs to subs via Stripe Connect Express accounts.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Volume This Month"
          value={fmt(data.totalVolumeThisMonth)}
          sub="Gross payment volume"
          icon={<DollarSign className="h-6 w-6 text-white" />}
          color="bg-green-600"
        />
        <StatCard
          title="Total Transactions"
          value={data.successfulTransactions}
          sub="All-time Stripe payments"
          icon={<Activity className="h-6 w-6 text-white" />}
          color="bg-primary"
        />
        <StatCard
          title="Active Express Accounts"
          value={data.activeAccounts}
          sub={setupRatio}
          icon={<CheckCircle2 className="h-6 w-6 text-white" />}
          color="bg-teal-600"
        />
        <StatCard
          title="Pending Verification"
          value={data.pendingAccounts}
          sub="Subs awaiting Stripe approval"
          icon={<Clock className="h-6 w-6 text-white" />}
          color="bg-yellow-500"
        />
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Recent Stripe Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.last20Transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No Stripe transactions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.last20Transactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">Invoice #{tx.invoiceNumber}</span>
                      {tx.subName && (
                        <span className="text-xs text-muted-foreground">→ {tx.subName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {tx.stripePaymentMethod && (
                        <Badge variant="outline" className="text-xs font-normal capitalize">
                          {tx.stripePaymentMethod.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {tx.stripePaymentIntentId && (
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
                          {tx.stripePaymentIntentId}
                        </span>
                      )}
                      {tx.stripePaymentInitiatedAt && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(tx.stripePaymentInitiatedAt), "MMM d, yyyy h:mm a")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmt(tx.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Account Status */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Sub Connect Account Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{data.activeAccounts}</p>
              <p className="text-xs font-semibold text-green-600 dark:text-green-500 mt-1">Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">Payouts enabled</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{data.pendingAccounts}</p>
              <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 mt-1">Pending</p>
              <p className="text-xs text-muted-foreground mt-0.5">Verification in progress</p>
            </div>
            <div className="p-4 rounded-xl bg-muted border border-border">
              <p className="text-3xl font-bold text-foreground">{data.totalAccounts}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-1">Total Connected</p>
              <p className="text-xs text-muted-foreground mt-0.5">Any Express account</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
