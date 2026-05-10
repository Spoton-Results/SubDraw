import * as React from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "../App";
import { getGetMeQueryKey } from "@workspace/api-client-react";

function getBaseUrl() {
  return import.meta.env.BASE_URL || "/";
}

export default function MagicLogin() {
  const [error, setError] = React.useState<string | null>(null);
  const BASE = getBaseUrl();

  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("This invite link is missing its login token.");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        // Move through the backend verifier from a real browser page, not directly
        // from the email client. This avoids many email-app/security-scanner issues.
        window.location.replace(`${BASE}api/auth/magic-link/verify?token=${encodeURIComponent(token!)}`);
      } catch {
        if (!cancelled) setError("This invite link could not be opened. Please request a new invite link.");
      }
    }

    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    run();

    return () => {
      cancelled = true;
    };
  }, [BASE]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {error ? (
          <>
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Invite link problem</h1>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => window.location.replace(`${BASE}login`)}>Go to Login</Button>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Opening your SubDraw invite…</h1>
            <p className="text-sm text-muted-foreground">Please wait while we securely sign you in.</p>
          </>
        )}
      </div>
    </div>
  );
}
