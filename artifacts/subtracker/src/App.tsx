import * as React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";
import ProjectDetail from "./pages/project-detail";
import SubcontractDetail from "./pages/subcontract-detail";
import NotFound from "./pages/not-found";
import ChangePassword from "./pages/change-password";

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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useGetMe({ query: { retry: false, staleTime: 30_000 } });

  if (isLoading) return null;
  if (!user) return <RedirectTo path="/login" />;

  if (user.mustChangePassword) {
    return (
      <ChangePassword
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        }}
      />
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/projects/:id" component={() => <ProtectedRoute component={ProjectDetail} />} />
      <Route path="/subcontracts/:id" component={() => <ProtectedRoute component={SubcontractDetail} />} />
      <Route component={NotFound} />
    </Switch>
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
          toastOptions={{
            duration: 4000,
            style: {
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '1rem',
              fontWeight: 600,
            }
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
