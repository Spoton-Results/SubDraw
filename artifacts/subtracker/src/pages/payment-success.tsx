import * as React from "react";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function PaymentSuccess() {
  usePageTitle("Payment Account Setup");
  const [, navigate] = useLocation();
  const [status, setStatus] = React.useState<"loading" | "active" | "pending">("loading");

  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${BASE}/api/stripe/connect/check-status`, { credentials: "include" });
        if (!res.ok) { if (!cancelled) setStatus("pending"); return; }
        const data = await res.json();
        if (!cancelled) setStatus(data.status === "ACTIVE" ? "active" : "pending");
      } catch {
        if (!cancelled) setStatus("pending");
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  return (
    <Layout>
      <div className="max-w-lg mx-auto mt-16 px-4">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span>Checking your account status…</span>
          </div>
        )}

        {status === "active" && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-700 dark:text-green-400">Payment account is active!</h1>
              <p className="text-muted-foreground mt-2">GCs can now pay you directly to your bank account. You'll see funds within 2 business days of each payment.</p>
            </div>
            <Button className="w-full min-h-[44px]" onClick={() => navigate("/account")}>
              Go to Account Settings
            </Button>
          </div>
        )}

        {status === "pending" && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-yellow-100 dark:bg-yellow-950/40 flex items-center justify-center">
                <Clock className="h-10 w-10 text-yellow-600" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Stripe is reviewing your information</h1>
              <p className="text-muted-foreground mt-2">This usually takes 1–2 business days. We'll notify you as soon as your account is ready to receive payments.</p>
            </div>
            <Button variant="outline" className="w-full min-h-[44px]" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
