const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

export async function getSubscriptionStatus() {
  const res = await fetch(`${API}/stripe/subscription-status`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch subscription status");
  return res.json() as Promise<{
    subscribed: boolean;
    plan: string | null;
    subscription: any | null;
  }>;
}

export async function getBilling() {
  const res = await fetch(`${API}/stripe/billing`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch billing info");
  return res.json() as Promise<{
    subscription: any | null;
    invoices: any[];
    stripeCustomerId: string | null;
  }>;
}

export async function startCheckout(): Promise<string> {
  const res = await fetch(`${API}/stripe/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to start checkout");
  }
  const data = await res.json();
  return data.url;
}

export async function cancelSubscription() {
  const res = await fetch(`${API}/stripe/cancel-subscription`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to cancel subscription");
  }
  return res.json();
}

export async function reactivateSubscription() {
  const res = await fetch(`${API}/stripe/reactivate-subscription`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to reactivate subscription");
  }
  return res.json();
}

export function formatSubscriptionStatus(status: string): { label: string; color: string } {
  switch (status) {
    case "active": return { label: "Active", color: "text-green-600" };
    case "trialing": return { label: "Trial", color: "text-blue-600" };
    case "past_due": return { label: "Payment Past Due", color: "text-orange-600" };
    case "canceled": return { label: "Cancelled", color: "text-red-600" };
    case "unpaid": return { label: "Unpaid", color: "text-red-600" };
    default: return { label: status, color: "text-muted-foreground" };
  }
}
