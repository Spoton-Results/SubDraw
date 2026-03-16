import * as React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { HardHat, LayoutDashboard, LogOut, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export function Layout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe({ query: { retry: false, staleTime: 30_000 } });
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("Logged out successfully");
      setLocation("/login");
    } catch {
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col shadow-sm hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold font-display text-primary">
            <HardHat className="h-6 w-6" />
            SubTracker
          </Link>
        </div>
        
        <div className="p-4 flex-1">
          <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-3 px-2">Menu</div>
          <nav className="space-y-1">
            <Link 
              href="/" 
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-medium transition-colors"
            >
              <LayoutDashboard className="h-5 w-5" />
              Projects
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between px-2 mb-4">
            <div className="flex flex-col">
              <span className="font-semibold text-sm">{user.companyName}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </div>
            <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-1 rounded uppercase">
              {user.role}
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center px-4 md:px-8 shadow-sm justify-between md:justify-end">
          <div className="md:hidden flex items-center gap-2">
            <HardHat className="h-6 w-6 text-primary" />
            <span className="font-bold font-display">SubTracker</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="md:hidden flex items-center gap-2 text-sm font-medium text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {user.companyName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
