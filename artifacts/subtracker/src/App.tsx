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
import Notifications from "./pages/notifications";
import Contacts from "./pages/contacts";
import Directory from "./pages/directory";
import ProfileSetup from "./pages/profile-setup";
import Billing from "./pages/billing";
import Team from "./pages/team";
import BidComparison from "./pages/bid-comparison";
import AdminLogin from "./pages/admin-login";
import AdminDashboard from "./pages/admin-dashboard";
import AdminAccountDetail from "./pages/admin-account-detail";
import SubmittalDetail from "./pages/submittal-detail";
import PaymentSuccess from "./pages/payment-success";
import PaymentSetupRefresh from "./pages/payment-setup-refresh";
import MagicLogin from "./pages/magic-login";
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

function Logout() {
  React.useEffect(() => {
    const runLogout = async () => {
      try {
        await fetch(`${import.meta.env.BASE_URL}api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // Continue clearing client state even if the network request fails.
      }

      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace(`${import.meta.env.BASE_URL}login`);
    };

    runLogout();
  }, []);

  return null;
}

/** Full-screen spinner shown while /api/auth/me is resolving after login */
function AuthLoading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        background: "var(--color-bg, hsl(var(--background)))",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid hsl(var(--border))",
          borderTopColor: "hsl(var(--primary))",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
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
  const { data: user, isLoading, isFetching } = useGetMe({ query: { retry: false, staleTime: 30_000 } });

  // Show spinner while loading OR while re-fetching with no cached user.
  // Without this, invalidateQueries briefly sets user=undefined which
  // triggers the redirect-to-login and causes the GC blank screen.
  if (isLoading || (!user && isFetching)) return <AuthLoading />;

  if (!user) return <RedirectTo path="/login" />;

  if ((user as any).paused) {
    const handleLogout = async () => {
      await fetch(`${import.meta.env.BASE_URL}api/auth/logout`, { method: "POST", credentials: "include" });
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
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

// ---------------------------------------------------------------------------
// Stable named wrapper components — MUST live outside Router/App so React
// never sees a new component type on re-render, which would unmount+remount
// ProtectedRoute and reset useGetMe back to isLoading=true (blank screen).
// ---------------------------------------------------------------------------
const DashboardRoute         = () => <ProtectedRoute component={Dashboard} />;
const DirectoryRoute         = () => <ProtectedRoute component={Directory} ownerOnly />;
const ProjectDetailRoute     = () => <ProtectedRoute component={ProjectDetail} />;
const BidComparisonRoute     = () => <ProtectedRoute component={BidComparison} gcOnly />;
const SubcontractDetailRoute = () => <ProtectedRoute component={SubcontractDetail} />;
const SubmittalDetailRoute   = () => <ProtectedRoute component={SubmittalDetail} />;
const AccountRoute           = () => <ProtectedRoute component={Account} />;
const NotificationsRoute     = () => <ProtectedRoute component={Notifications} />;
const ContactsRoute          = () => <ProtectedRoute component={Contacts} ownerOnly />;
const TeamRoute              = () => <ProtectedRoute component={Team} ownerOnly />;
const BillingRoute           = () => <ProtectedRoute component={Billing} ownerOnly />;
const PaymentSuccessRoute    = () => <ProtectedRoute component={PaymentSuccess} />;
const PaymentSetupRoute      = () => <ProtectedRoute component={PaymentSetupRefresh} />;

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
        <Route path="/logout" component={Logout} />
        <Route path="/admin" component={AdminLogin} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/accounts/:userId" component={AdminAccountDetail} />
        <Route path="/login" component={Login} />
        <Route path="/magic-login" component={MagicLogin} />
        <Route path="/register" component={Register} />
        <Route path="/signup" component={Register} />
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={DashboardRoute} />
        <Route path="/directory" component={DirectoryRoute} />
        <Route path="/projects/:id" component={ProjectDetailRoute} />
        <Route path="/projects/:id/bid-comparison" component={BidComparisonRoute} />
        <Route path="/subcontracts/:id" component={SubcontractDetailRoute} />
        <Route path="/submittals/:id" component={SubmittalDetailRoute} />
        <Route path="/account" component={AccountRoute} />
        <Route path="/notifications" component={NotificationsRoute} />
        <Route path="/contacts" component={ContactsRoute} />
        <Route path="/team" component={TeamRoute} />
        <Route path="/billing" component={BillingRoute} />
        <Route path="/account/payment-success" component={PaymentSuccessRoute} />
        <Route path="/account/payment-setup" component={PaymentSetupRoute} />
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
