import * as React from "react";
import { useLocation } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "../App";
import { getGetMeQueryKey } from "@workspace/api-client-react";

function getBaseUrl() {
  return import.meta.env.BASE_URL || "/";
}

export default function MagicLogin() {
  const [, setLocation] = useLocation();
  const [error, setError] = React.useState<string | null>(null);
  const BASE = getBaseUrl();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const projectId = params.get("projectId");

    if (!token) {
      setError("This invite link is missing its login token.");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        if (projectId) {
          sessionStorage.setItem("subdraw_invite_project_id", projectId);
          sessionStorage.setItem("subdraw_post_login_redirect", `/projects/${projectId}`);
        }

        // Use fetch() so the browser keeps the React app alive (no full page reload).
        // The server sets the session cookie on this response.
        const res = await fetch(
          `${BASE}api/auth/magic-link/verify?token=${encodeURIComponent(token!)}`,
          {
            method: "GET",
            credentials: "include",
            redirect: "manual", // don't follow server redirect — we handle navigation
          }
        );

        if (cancelled) return;

        // Any 2xx or 3xx means the server accepted the token and set the cookie.
        // Now fetch the user so we can pre-seed the query cache.
        if (res.ok || res.status === 0 || (res.status >= 300 && res.status < 400)) {
          // Fetch the current user to warm the cache before navigating
          const meRes = await fetch(`${BASE}api/auth/me`, {
            credentials: "include",
            headers: { Accept: "application/json" },
            cache: "no-store",
          });

          if (cancelled) return;

          if (meRes.ok) {
            const userData = await meRes.json().catch(() => null);
            if (userData) {
              queryClient.setQueryData(getGetMeQueryKey(), userData);
            }
            // Navigate inside React — no hard reload, no blank screen
            const redirect = projectId
              ? `/projects/${projectId}`
              : "/dashboard";
            setLocation(redirect);
          } else {
            // Cookie didn't stick — fall back to hard redirect so server can handle it
            window.location.replace(
              `${BASE}api/auth/magic-link/verify?token=${encodeURIComponent(token!)}`
            );
          }
        } else {
          // Token rejected by server
          const body = await res.json().catch(() => null);
          const msg = body?.error || "This login link is invalid or has expired.";
          if (!cancelled) setError(msg);
        }
      } catch {
        // Network error or fetch blocked — fall back to hard redirect
        if (!cancelled) {
          window.location.replace(
            `${BASE}api/auth/magic-link/verify?token=${encodeURIComponent(token!)}`
          );
        }
      }
    }

    // Clear any stale session before verifying
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    run();

    return () => {
      cancelled = true;
    };
  }, [BASE, setLocation]);

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
