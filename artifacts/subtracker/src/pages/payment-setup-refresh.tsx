import * as React from "react";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function PaymentSetupRefresh() {
  usePageTitle("Payment Account Setup");
  const [loading, setLoading] = React.useState(false);

  const handleResume = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/stripe/connect/create-account`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-lg mx-auto mt-16 px-4 text-center space-y-6">
        <h1 className="text-2xl font-bold">Resume Payment Account Setup</h1>
        <p className="text-muted-foreground">Your Stripe onboarding session expired. Click below to continue where you left off.</p>
        <Button className="w-full min-h-[44px] gap-2" isLoading={loading} onClick={handleResume}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue Setup
        </Button>
      </div>
    </Layout>
  );
}
