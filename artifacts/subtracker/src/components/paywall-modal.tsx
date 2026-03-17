import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/lib/stripe";
import toast from "react-hot-toast";
import { CheckCircle2, Loader2, Zap } from "lucide-react";

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BENEFITS = [
  "Unlimited projects",
  "Unlimited subcontractors",
  "Invoice PDF generation",
  "Payment tracking and confirmation",
  "Priority support",
];

export function PaywallModal({ open, onOpenChange }: PaywallModalProps) {
  const [loading, setLoading] = React.useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const url = await startCheckout();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upgrade to SubTracker Pro"
      description="You've used your free project. Upgrade to manage unlimited projects."
    >
      <div className="space-y-5 mt-1">
        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-lg text-foreground">SubTracker Pro</div>
              <div className="text-muted-foreground text-sm">For General Contractors</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">$49</div>
              <div className="text-xs text-muted-foreground">per month</div>
            </div>
          </div>

          <ul className="space-y-2.5">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-foreground">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <Button
            className="w-full h-11 text-base font-semibold"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Redirecting to checkout...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Upgrade Now — $49/month
              </>
            )}
          </Button>
          <button
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Secure payment via Stripe. Cancel anytime.
        </p>
      </div>
    </Dialog>
  );
}
