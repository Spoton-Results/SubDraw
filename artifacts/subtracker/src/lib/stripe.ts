const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

export async function getSubscriptionStatus() {
  const res = await fetch(`${API}/stripe/subscription-status`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch subscription status");
  return res.json() as Promise<{
    subscribed: boolean;
    planName: string | null;
    planLabel: string | null;
    limit: number | null;
    activeCount: number;
    nextPlan: { name: string; limit: number; monthlyUsd: number; label: string } | null;
    isPastDue: boolean;
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
    planName: string | null;
    planLabel: string | null;
    limit: number | null;
    activeCount: number;
    nextPlan: { name: string; limit: number; monthlyUsd: number; label: string } | null;
    isPastDue: boolean;
    isInGrace: boolean;
  }>;
}

export async function startCheckout(planName: string): Promise<string> {
  const res = await fetch(`${API}/stripe/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to start checkout");
  }
  const data = await res.json();
  return data.url;
}

export async function upgradePlan(planName: string): Promise<void> {
  const res = await fetch(`${API}/stripe/upgrade`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to upgrade plan");
  }
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

export function formatPlanPrice(monthlyUsd: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(monthlyUsd / 100);
}
