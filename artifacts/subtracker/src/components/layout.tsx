import * as React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { HardHat, LayoutDashboard, LogOut, Loader2, Settings, ChevronDown, BookUser, User, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
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

  const isActive = (path: string) => location === path;

  const navItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${
        isActive(href)
          ? "bg-primary/10 text-primary"
          : "text-foreground/70 hover:bg-secondary hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      {/* Sidebar — desktop only */}
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
            {navItem("/", <LayoutDashboard className="h-5 w-5" />, "Projects")}
            {user.role === "GC" && navItem("/contacts", <BookUser className="h-5 w-5" />, "Contact Book")}
            {user.role === "SUB" && navItem("/account", <User className="h-5 w-5" />, "My Profile")}
            {navItem("/account", <Settings className="h-5 w-5" />, "Account Settings")}
            {user.role === "GC" && navItem("/billing", <CreditCard className="h-5 w-5" />, "Billing")}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
              {user.companyName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm block truncate">{user.companyName}</span>
              <span className="text-xs text-muted-foreground block truncate">{user.email}</span>
            </div>
            <Badge variant={user.role === "GC" ? "default" : "secondary"} className="text-[10px] shrink-0">
              {user.role}
            </Badge>
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
        <header className="h-16 bg-card border-b border-border flex items-center px-4 md:px-8 shadow-sm justify-between">
          <div className="md:hidden flex items-center gap-2">
            <HardHat className="h-6 w-6 text-primary" />
            <span className="font-bold font-display">SubTracker</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-muted-foreground text-sm">
            {/* Breadcrumb or empty, handled per-page */}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-secondary rounded-xl px-2 py-1.5 transition-colors min-h-[44px]">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {user.companyName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-semibold leading-tight">{user.companyName}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{user.role}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/account" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </Link>
              </DropdownMenuItem>
              {user.role === "GC" && (
                <DropdownMenuItem asChild>
                  <Link href="/billing" className="flex items-center gap-2 cursor-pointer">
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-stretch shadow-lg">
        <Link
          href="/"
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors min-h-[56px] ${
            isActive("/") ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard className={`h-5 w-5 ${isActive("/") ? "text-primary" : ""}`} />
          Projects
        </Link>
        {user.role === "GC" && (
          <Link
            href="/contacts"
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors min-h-[56px] ${
              isActive("/contacts") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <BookUser className={`h-5 w-5 ${isActive("/contacts") ? "text-primary" : ""}`} />
            Contacts
          </Link>
        )}
        <Link
          href="/account"
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors min-h-[56px] ${
            isActive("/account") ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Settings className={`h-5 w-5 ${isActive("/account") ? "text-primary" : ""}`} />
          Account
        </Link>
      </nav>
    </div>
  );
}
