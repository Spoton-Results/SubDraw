import * as React from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";
import ProjectDetail from "./pages/project-detail";
import SubcontractDetail from "./pages/subcontract-detail";
import NotFound from "./pages/not-found";
import ChangePassword from "./pages/change-password";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import Account from "./pages/account";
import Contacts from "./pages/contacts";
import ProfileSetup from "./pages/profile-setup";
import Billing from "./pages/billing";
import Team from "./pages/team";
import BidComparison from "./pages/bid-comparison";
import AdminLogin from "./pages/admin-login";
import AdminDashboard from "./pages/admin-dashboard";
import SubmittalDetail from "./pages/submittal-detail";
import { PausedScreen } from "./components/paused-screen";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RedirectTo({ path }: { path: string }) {
  const [, setLocation] = useLocation();
  React.useLayoutEffect(() => {
    setLocation(path);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ProtectedRoute({
  component: Component,
  gcOnly,
  ownerOnly,
}: {
  component: React.ComponentType;
  gcOnly?: boolean;
  ownerOnly?: boolean;
}) {
  const { data: user, isLoading } = useGetMe({ query: { retry: false, staleTime: 30_000 } });

  if (isLoading) return null;
  if (!user) return <RedirectTo path="/login" />;

  // Paused account — show paused screen (bypass for impersonation)
  if ((user as any).paused) {
    const handleLogout = async () => {
      await fetch(`${import.meta.env.BASE_URL}api/auth/logout`, { method: "POST", credentials: "include" });
      queryClient.clear();
      window.location.href = `${import.meta.env.BASE_URL}login`;
    };
    return <PausedScreen companyName={user.companyName} onLogout={handleLogout} />;
  }

  if (user.mustChangePassword) {
    return (
      <ChangePassword
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        }}
      />
    );
  }

  if (user.role === "SUB" && user.subProfile === null) {
    return (
      <ProfileSetup
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        }}
      />
    );
  }

  if (gcOnly && user.role !== "GC") return <RedirectTo path="/dashboard" />;

  const gcTeamRole = (user as any).gcTeamRole as string | null | undefined;
  const isOwner = user.role === "GC" && (gcTeamRole === "owner" || gcTeamRole == null);
  if (ownerOnly && !isOwner) return <RedirectTo path="/dashboard" />;

  return <Component />;
}

function AnalyticsTracker() {
  const [location] = useLocation();
  const { data: user } = useGetMe({ query: { retry: false, staleTime: 30_000 } });
  React.useEffect(() => {
    if (typeof window.gtag === "function") {
      window.gtag("config", "G-GY5VTKVQ88", { page_path: location });
    }
    fetch(`${import.meta.env.BASE_URL}api/analytics/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location, isAuthenticated: !!user }),
    }).catch(() => {});
  }, [location, user]);
  return null;
}

function Router() {
  return (
    <>
      <AnalyticsTracker />
      <Switch>
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/signup" component={Register} />
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/projects/:id" component={() => <ProtectedRoute component={ProjectDetail} />} />
      <Route path="/projects/:id/bid-comparison" component={() => <ProtectedRoute component={BidComparison} gcOnly />} />
      <Route path="/subcontracts/:id" component={() => <ProtectedRoute component={SubcontractDetail} />} />
      <Route path="/submittals/:id" component={() => <ProtectedRoute component={SubmittalDetail} />} />
      <Route path="/account" component={() => <ProtectedRoute component={Account} />} />
      <Route path="/contacts" component={() => <ProtectedRoute component={Contacts} ownerOnly />} />
      <Route path="/team" component={() => <ProtectedRoute component={Team} ownerOnly />} />
      <Route path="/billing" component={() => <ProtectedRoute component={Billing} ownerOnly />} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster
          position="top-center"
          containerStyle={{ maxWidth: "calc(100vw - 32px)" }}
          toastOptions={{
            duration: 4000,
            style: {
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '1rem',
              fontWeight: 600,
              maxWidth: "calc(100vw - 32px)",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
