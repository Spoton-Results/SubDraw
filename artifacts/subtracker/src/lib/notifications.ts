const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  data: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  invoiceSubmitted: boolean;
  invoiceFlagged: boolean;
  invoiceApproved: boolean;
  invoiceRejected: boolean;
  changeOrderCreated: boolean;
  changeOrderApproved: boolean;
  changeOrderRejected: boolean;
  changeOrderRequest: boolean;
  paymentManual: boolean;
  paymentStripe: boolean;
  paymentConfirmed: boolean;
  paymentDisputed: boolean;
  insuranceExpiring: boolean;
  licenseExpiring: boolean;
  submittalReceived: boolean;
  submittalOverdue: boolean;
  paymentSetupReminder: boolean;
  stripeAccountActive: boolean;
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

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch(`${BASE}/api/push/preferences`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch notification preferences");
  return res.json();
}

export async function updateNotificationPreferences(updates: Partial<Omit<NotificationPreferences, "id" | "userId">>): Promise<NotificationPreferences> {
  const res = await fetch(`${BASE}/api/push/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update notification preferences");
  return res.json();
}

export async function subscribeToPush(): Promise<boolean> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!VAPID_PUBLIC_KEY) return false;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const subJson = sub.toJSON();
  const res = await fetch(`${BASE}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth,
      userAgent: navigator.userAgent,
    }),
  });
  return res.ok;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (sub) {
    await fetch(`${BASE}/api/push/unsubscribe`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
  return true;
}

export async function getPushSubscriptionStatus(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  const perm = Notification.permission;
  if (perm === "granted") {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg) return "default";
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    return sub ? "granted" : "default";
  }
  return perm as "denied" | "default";
}

export async function dismissPushPrompt(): Promise<void> {
  await fetch(`${BASE}/api/push/dismiss-prompt`, { method: "POST", credentials: "include" });
}

export async function dismissHomeScreenBanner(): Promise<void> {
  await fetch(`${BASE}/api/push/dismiss-home-screen`, { method: "POST", credentials: "include" });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
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
