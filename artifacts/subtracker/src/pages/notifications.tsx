import * as React from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/notifications";
import type { Notification } from "@/lib/notifications";
import { Bell, Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { usePageTitle } from "@/hooks/usePageTitle";

const TYPE_LABELS: Record<string, string> = {
  INVOICE_SUBMITTED: "Invoice",
  INVOICE_FLAGGED: "Invoice",
  INVOICE_APPROVED: "Invoice",
  INVOICE_REJECTED: "Invoice",
  CO_CREATED: "Change Order",
  CO_SUBMITTED_BY_SUB: "Change Order",
  CO_APPROVED_BY_SUB: "Change Order",
  CO_REJECTED_BY_SUB: "Change Order",
  CO_GC_APPROVED: "Change Order",
  CO_GC_REJECTED: "Change Order",
  PAYMENT_MANUAL: "Payment",
  PAYMENT_STRIPE: "Payment",
  PAYMENT_CONFIRMED: "Payment",
  PAYMENT_DISPUTED: "Payment",
  SUBMITTAL_CREATED: "Submittal",
  SUBMITTAL_MESSAGE: "Submittal",
  SUBMITTAL_ACKNOWLEDGED: "Submittal",
  INSURANCE_EXPIRING: "Insurance",
  LICENSE_EXPIRING: "License",
  PAYMENT_SETUP_REMINDER: "Setup",
  STRIPE_ACCOUNT_ACTIVE: "Stripe",
};

const TYPE_COLORS: Record<string, string> = {
  INVOICE_SUBMITTED: "bg-blue-100 text-blue-700",
  INVOICE_FLAGGED: "bg-orange-100 text-orange-700",
  INVOICE_APPROVED: "bg-green-100 text-green-700",
  INVOICE_REJECTED: "bg-red-100 text-red-700",
  CO_CREATED: "bg-purple-100 text-purple-700",
  CO_SUBMITTED_BY_SUB: "bg-purple-100 text-purple-700",
  CO_APPROVED_BY_SUB: "bg-green-100 text-green-700",
  CO_REJECTED_BY_SUB: "bg-red-100 text-red-700",
  CO_GC_APPROVED: "bg-green-100 text-green-700",
  CO_GC_REJECTED: "bg-red-100 text-red-700",
  PAYMENT_MANUAL: "bg-teal-100 text-teal-700",
  PAYMENT_STRIPE: "bg-teal-100 text-teal-700",
  PAYMENT_CONFIRMED: "bg-green-100 text-green-700",
  PAYMENT_DISPUTED: "bg-red-100 text-red-700",
  SUBMITTAL_CREATED: "bg-blue-100 text-blue-700",
  SUBMITTAL_MESSAGE: "bg-blue-100 text-blue-700",
  SUBMITTAL_ACKNOWLEDGED: "bg-green-100 text-green-700",
  INSURANCE_EXPIRING: "bg-orange-100 text-orange-700",
  LICENSE_EXPIRING: "bg-orange-100 text-orange-700",
};

export default function Notifications() {
  usePageTitle("Notifications");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = notifications.filter(n => !n.readAt).length;

  const handleClick = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.url) navigate(n.url);
    else {
      const data = n.data ? JSON.parse(n.data) : {};
      if (data.submittalId) navigate(`/submittals/${data.submittalId}`);
      else if (data.subcontractId) navigate(`/subcontracts/${data.subcontractId}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Bell className="h-12 w-12 opacity-20" />
            <p className="font-medium">No notifications yet</p>
            <p className="text-sm text-center max-w-xs">
              You'll see alerts here when invoices, change orders, payments, and submittals need your attention.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const label = TYPE_LABELS[n.type] ?? "Notification";
              const color = TYPE_COLORS[n.type] ?? "bg-gray-100 text-gray-700";
              const isClickable = !!(n.url || (n.data && (JSON.parse(n.data).subcontractId || JSON.parse(n.data).submittalId)));
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`group relative bg-card border border-border rounded-xl p-4 flex items-start gap-3 transition-colors ${
                    isClickable ? "cursor-pointer hover:bg-muted/50" : ""
                  } ${!n.readAt ? "ring-1 ring-primary/20 bg-primary/5" : ""}`}
                >
                  {!n.readAt && (
                    <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
                        {label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={`text-sm font-semibold leading-tight ${n.readAt ? "text-muted-foreground" : "text-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                  </div>
                  {isClickable && (
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-1 transition-colors" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
