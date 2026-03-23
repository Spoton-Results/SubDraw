const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(): Promise<Notification[]> {
  const res = await fetch(`${BASE}/api/notifications`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const res = await fetch(`${BASE}/api/notifications/unread-count`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await fetch(`${BASE}/api/notifications/${id}/read`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to mark notification read");
  return res.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${BASE}/api/notifications/read-all`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to mark all read");
}

export async function gcApproveChangeOrder(subcontractId: string, changeOrderId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/subcontracts/${subcontractId}/change-orders/${changeOrderId}/gc-approve`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error || "Failed to approve change order");
  }
}

export async function gcRejectChangeOrder(subcontractId: string, changeOrderId: string, rejectionReason?: string): Promise<void> {
  const res = await fetch(`${BASE}/api/subcontracts/${subcontractId}/change-orders/${changeOrderId}/gc-reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ rejectionReason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error || "Failed to void change order");
  }
}
