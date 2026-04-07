import * as React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { HardHat, LayoutDashboard, LogOut, Loader2, Settings, ChevronDown, BookUser, User, CreditCard, FlaskConical, ArrowRight, Users, Bell, Check, Shield } from "lucide-react";
import { DemoWalkthroughProvider, DemoProgressBar, DemoWalkthroughOverlay } from "@/components/demo-walkthrough";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSubscriptionStatus } from "@/lib/stripe";
import { TrialExpiredGate } from "@/components/trial-expired-gate";
import { usePermissions, GC_TEAM_ROLE_META } from "@/hooks/usePermissions";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/notifications";
import type { Notification } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";

function NotificationBell({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [open, setOpen] = React.useState(false);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => refetch(),
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => refetch(),
  });

  const unread = notifications.filter(n => !n.readAt).length;

  const handleClick = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    const data = n.data ? JSON.parse(n.data) : {};
    if (data.subcontractId) onNavigate(`/subcontracts/${data.subcontractId}`);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center justify-center h-9 w-9 rounded-xl hover:bg-secondary transition-colors" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[480px] p-0 flex flex-col overflow-hidden" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-primary hover:underline flex items-center gap-1"
              disabled={markAll.isPending}
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Bell className="h-8 w-8 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.slice(0, 30).map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border last:border-b-0 flex items-start gap-3 ${!n.readAt ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
              >
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${!n.readAt ? "bg-amber-500" : "bg-transparent"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight mb-0.5 ${!n.readAt ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe({ query: { retry: false, staleTime: 30_000 } });
  const logout = useLogout();
  const perms = usePermissions();

  const isTeamMember = perms.isGC && !perms.isOwner;
  const roleMeta = perms.role ? GC_TEAM_ROLE_META[perms.role] : null;
  const displayName = isTeamMember ? ((user as any)?.displayName || user?.companyName) : user?.companyName;

  const { data: subStatus } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getSubscriptionStatus,
    enabled: perms.isOwner,
    staleTime: 60_000,
  });

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

  const showTrialGate =
    perms.isOwner &&
    !(user as any).isDemo &&
    subStatus?.trialExpired === true &&
    !subStatus?.subscribed &&
    location !== "/billing";

  if (showTrialGate) {
    return (
      <TrialExpiredGate
        companyName={user.companyName}
        onLogout={handleLogout}
      />
    );
  }

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

  const roleLabel = roleMeta?.label ?? (user.role === "GC" ? "GC" : "SUB");

  const isDemoGC = (user as any).isDemo === true && user.role === "GC";

  return (
    <DemoWalkthroughProvider isDemoGC={isDemoGC}>
    <div className="min-h-screen bg-secondary/30 flex overflow-x-hidden w-full">
      {/* Sidebar — desktop only */}
      <aside className="w-64 bg-card border-r border-border flex flex-col shadow-sm hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold font-display text-primary">
            <HardHat className="h-6 w-6" />
            SubTracker
          </Link>
        </div>

        <div className="p-4 flex-1">
          <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-3 px-2">Menu</div>
          <nav className="space-y-1">
            {navItem("/dashboard", <LayoutDashboard className="h-5 w-5" />, "Projects")}
            {perms.isOwner && navItem("/contacts", <BookUser className="h-5 w-5" />, "Contact Book")}
            {user.role === "SUB" && navItem("/account", <User className="h-5 w-5" />, "My Profile")}
            {navItem("/account", <Settings className="h-5 w-5" />, "Account Settings")}
            {perms.canManageTeam && navItem("/team", <Users className="h-5 w-5" />, "Team")}
            {perms.canAccessBilling && navItem("/billing", <CreditCard className="h-5 w-5" />, "Billing")}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
              {(displayName || user.companyName).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm block truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground block truncate">{user.email}</span>
            </div>
            <Badge
              variant="secondary"
              className={`text-[10px] shrink-0 border ${roleMeta?.color ?? ""}`}
            >
              {perms.isOwner ? "GC" : perms.role === "vp_operations" ? "VP" : perms.role === "project_manager" ? "PM" : perms.role === "project_engineer" ? "PE" : perms.role === "contract_administrator" ? "CA" : perms.role ? perms.role.slice(0, 3).toUpperCase() : user.role}
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
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center px-4 md:px-8 shadow-sm justify-between">
          <div className="md:hidden flex items-center gap-2">
            <HardHat className="h-6 w-6 text-primary" />
            <span className="font-bold font-display">SubTracker</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-muted-foreground text-sm">
            {/* Breadcrumb or empty, handled per-page */}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell onNavigate={setLocation} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-secondary rounded-xl px-2 py-1.5 transition-colors min-h-[44px]">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {(displayName || user.companyName).charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-semibold leading-tight">{displayName}</span>
                    <span className="text-xs text-muted-foreground leading-tight">{roleLabel}</span>
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
                {perms.canManageTeam && (
                  <DropdownMenuItem asChild>
                    <Link href="/team" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4" />
                      Team
                    </Link>
                  </DropdownMenuItem>
                )}
                {perms.canAccessBilling && (
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
          </div>
        </header>

        {(user as any).impersonatedBy && (
          <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium min-w-0">
              <Shield className="h-4 w-4 shrink-0" />
              <span className="truncate">Admin impersonation active — viewing as <strong>{user.companyName}</strong></span>
            </div>
            <button
              onClick={async () => {
                try {
                  const BASE = import.meta.env.BASE_URL;
                  await fetch(`${BASE}api/admin/impersonation/exit`, { method: "POST", credentials: "include" });
                  queryClient.clear();
                  window.location.href = `${BASE}admin/dashboard`;
                } catch {
                  toast.error("Failed to exit impersonation");
                }
              }}
              className="flex items-center gap-1 text-sm font-bold bg-white text-red-700 hover:bg-red-50 px-3 py-1 rounded-lg shrink-0 transition-colors"
            >
              Exit Impersonation <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <DemoProgressBar />
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-stretch shadow-lg">
        <Link
          href="/dashboard"
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors min-h-[56px] ${
            isActive("/dashboard") ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard className={`h-5 w-5 ${isActive("/dashboard") ? "text-primary" : ""}`} />
          Projects
        </Link>
        {perms.isOwner && (
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
        {perms.canManageTeam && (
          <Link
            href="/team"
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors min-h-[56px] ${
              isActive("/team") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Users className={`h-5 w-5 ${isActive("/team") ? "text-primary" : ""}`} />
            Team
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
      <DemoWalkthroughOverlay />
    </div>
    </DemoWalkthroughProvider>
  );
}
