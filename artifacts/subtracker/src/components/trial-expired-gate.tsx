import * as React from "react";
import { startCheckout, formatPlanPrice } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Zap, TrendingUp, Rocket, HardHat, LogOut, Building2 } from "lucide-react";
import toast from "react-hot-toast";

const PLANS = [
  {
    name: "SubTracker Starter" as const,
    label: "Starter",
    monthlyUsd: 19900,
    limit: 10 as number | null,
    icon: Zap,
    color: "border-blue-200",
    headerColor: "text-blue-700",
    buttonVariant: "outline" as const,
  },
  {
    name: "SubTracker Growth" as const,
    label: "Growth",
    monthlyUsd: 29900,
    limit: 20 as number | null,
    icon: TrendingUp,
    color: "border-primary ring-2 ring-primary",
    headerColor: "text-primary",
    buttonVariant: "default" as const,
    popular: true,
  },
  {
    name: "SubTracker Scale" as const,
    label: "Scale",
    monthlyUsd: 39900,
    limit: 40 as number | null,
    icon: Rocket,
    color: "border-violet-200",
    headerColor: "text-violet-700",
    buttonVariant: "outline" as const,
  },
  {
    name: "SubTracker Enterprise" as const,
    label: "Enterprise",
    monthlyUsd: 69900,
    limit: null as number | null,
    icon: Building2,
    color: "border-border",
    headerColor: "text-foreground",
    buttonVariant: "outline" as const,
  },
];

const FEATURES = [
  "Unlimited GC users",
  "Unlimited subcontractor invites",
  "Invoice PDF generation",
  "Payment tracking & confirmation",
  "Change order management",
  "All features included",
];

interface TrialExpiredGateProps {
  companyName: string;
  onLogout: () => void;
}

export function TrialExpiredGate({ companyName, onLogout }: TrialExpiredGateProps) {
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);

  const handleSelect = async (planName: string) => {
    setLoadingPlan(planName);
    try {
      const url = await startCheckout(planName);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-2 text-xl font-bold font-display text-primary">
          <HardHat className="h-6 w-6" />
          SubTracker
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:block">{companyName}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 pt-10 pb-16">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              <Zap className="h-4 w-4" />
              Free trial ended
            </div>
            <h1 className="text-3xl font-bold font-display text-foreground mb-2">
              Choose a plan to continue
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your 14-day free trial has ended. All your data is safe — select a plan to pick up right where you left off.
            </p>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isLoading = loadingPlan === plan.name;
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border-2 bg-card p-5 flex flex-col gap-3 shadow-sm ${plan.color}`}
                >
                  {(plan as any).popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-0.5 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${plan.headerColor}`} />
                    <span className={`font-bold ${plan.headerColor}`}>{plan.label}</span>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-foreground">
                      {formatPlanPrice(plan.monthlyUsd)}
                    </div>
                    <div className="text-xs text-muted-foreground">/month</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {plan.limit === null ? "Unlimited subcontracts" : `Up to ${plan.limit} active subcontracts`}
                  </div>
                  <Button
                    variant={plan.buttonVariant}
                    className="w-full mt-auto"
                    onClick={() => handleSelect(plan.name)}
                    disabled={loadingPlan !== null}
                  >
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirecting...</>
                    ) : (
                      `Select ${plan.label}`
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Features included */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <p className="text-sm font-semibold text-foreground mb-3">All plans include:</p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
              {FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Secure payment via Stripe. Cancel anytime. Your data is never deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
