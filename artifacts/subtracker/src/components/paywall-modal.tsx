import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { startCheckout, formatPlanPrice } from "@/lib/stripe";
import toast from "react-hot-toast";
import { CheckCircle2, Loader2, Zap, TrendingUp, Rocket } from "lucide-react";

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If set, shows a plan-limit message instead of the generic "first project free" message */
  limitMessage?: string;
  /** Pre-select the suggested next plan */
  suggestedPlanName?: string;
}

const PLANS = [
  {
    name: "SubTracker Starter" as const,
    label: "Starter",
    monthlyUsd: 39900,
    limit: 5,
    icon: Zap,
    color: "border-blue-200 bg-blue-50/50",
    headerColor: "text-blue-700",
    badgeColor: "bg-blue-100 text-blue-700",
    buttonVariant: "outline" as const,
  },
  {
    name: "SubTracker Growth" as const,
    label: "Growth",
    monthlyUsd: 59900,
    limit: 20,
    icon: TrendingUp,
    color: "border-primary bg-primary/5 ring-2 ring-primary",
    headerColor: "text-primary",
    badgeColor: "bg-primary/10 text-primary",
    buttonVariant: "default" as const,
    popular: true,
  },
  {
    name: "SubTracker Scale" as const,
    label: "Scale",
    monthlyUsd: 79900,
    limit: 30,
    icon: Rocket,
    color: "border-violet-200 bg-violet-50/50",
    headerColor: "text-violet-700",
    badgeColor: "bg-violet-100 text-violet-700",
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

export function PaywallModal({ open, onOpenChange, limitMessage, suggestedPlanName }: PaywallModalProps) {
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Choose a Plan"
      description={limitMessage || "Your first project is free. Select a plan to manage more projects."}
    >
      <div className="space-y-4 mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isLoading = loadingPlan === plan.name;
            const isSuggested = suggestedPlanName === plan.name;
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border-2 p-4 flex flex-col ${plan.color} ${isSuggested ? "ring-2 ring-offset-1 ring-primary" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-4 w-4 ${plan.headerColor}`} />
                  <span className={`font-bold text-sm ${plan.headerColor}`}>{plan.label}</span>
                </div>
                <div className="mb-3">
                  <div className="text-2xl font-bold text-foreground">
                    {formatPlanPrice(plan.monthlyUsd)}
                  </div>
                  <div className="text-xs text-muted-foreground">/month</div>
                </div>
                <div className={`text-xs font-semibold px-2 py-1 rounded-lg mb-3 text-center ${plan.badgeColor}`}>
                  Up to {plan.limit} active projects
                </div>
                <Button
                  size="sm"
                  variant={plan.buttonVariant}
                  className="w-full mt-auto"
                  onClick={() => handleSelect(plan.name)}
                  disabled={loadingPlan !== null}
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Select"
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">All plans include:</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-foreground">
                <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Secure payment via Stripe. Cancel anytime.</p>
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </button>
        </div>
      </div>
    </Dialog>
  );
}
