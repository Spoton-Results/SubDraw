const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

export interface TrialInfo {
  trialActive: boolean;
  trialExpired: boolean;
  trialDaysLeft: number;
  trialEndsAt: string | null;
}

export interface SubscriptionStatus extends TrialInfo {
  subscribed: boolean;
  planName: string | null;
  planLabel: string | null;
  limit: number | null;
  activeCount: number;
  nextPlan: { name: string; limit: number | null; monthlyUsd: number; annualUsd: number; label: string } | null;
  isPastDue: boolean;
  isInGrace: boolean;
  billingInterval: string | null;
  subscription: any | null;
  annualRenewsAt: string | null;
}

export interface ProjectBreakdown {
  projectId: string;
  projectName: string;
  status: string;
  subcontractCount: number;
}

export interface BillingInfo extends TrialInfo {
  subscription: any | null;
  invoices: any[];
  stripeCustomerId: string | null;
  planName: string | null;
  planLabel: string | null;
  limit: number | null;
  activeCount: number;
  nextPlan: { name: string; limit: number | null; monthlyUsd: number; annualUsd: number; label: string } | null;
  isPastDue: boolean;
  isInGrace: boolean;
  billingInterval: string | null;
  projectsBreakdown: ProjectBreakdown[];
  nextChargeAmount: number | null;
  annualRenewsAt: string | null;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const err = await res.json().catch(() => ({}));
    return (err as any).error || (err as any).message || fallback;
  }

  const text = await res.text().catch(() => "");
  const cleaned = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? `${fallback}: ${cleaned.slice(0, 300)}` : fallback;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const res = await fetch(`${API}/stripe/subscription-status`, { credentials: "include" });
  if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch subscription status"));
  return res.json();
}

export async function getBilling(): Promise<BillingInfo> {
  const res = await fetch(`${API}/stripe/billing`, { credentials: "include" });
  if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch billing info"));
  return res.json();
}

export async function startCheckout(planName: string): Promise<string> {
  const res = await fetch(`${API}/stripe/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planName }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to start checkout"));
  }
  const data = await res.json();
  if (!data?.url) throw new Error("Stripe checkout did not return a checkout URL");
  return data.url;
}

export async function startAnnualCheckout(planName: string): Promise<string> {
  const res = await fetch(`${API}/stripe/annual-checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planName }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to start annual checkout"));
  }
  const data = await res.json();
  if (!data?.url) throw new Error("Stripe checkout did not return a checkout URL");
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
    throw new Error(await readApiError(res, "Failed to upgrade plan"));
  }
}

export async function switchBillingInterval(interval: "month" | "year"): Promise<void> {
  const res = await fetch(`${API}/stripe/switch-billing-interval`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to switch billing interval"));
  }
}

export async function cancelSubscription() {
  const res = await fetch(`${API}/stripe/cancel-subscription`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to cancel subscription"));
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
    throw new Error(await readApiError(res, "Failed to reactivate subscription"));
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

export function formatPlanPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}
