import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

export async function getSubscriptionForUser(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.stripeSubscriptionId) return null;
  return getSubscriptionById(user.stripeSubscriptionId);
}

export async function getSubscriptionById(subscriptionId: string) {
  const result = await db.execute(
    sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId} LIMIT 1`
  );
  return (result.rows[0] as any) ?? null;
}

export async function getCustomerById(customerId: string) {
  const result = await db.execute(
    sql`SELECT * FROM stripe.customers WHERE id = ${customerId} LIMIT 1`
  );
  return (result.rows[0] as any) ?? null;
}

export async function getInvoicesForCustomer(customerId: string, limit = 12) {
  const result = await db.execute(
    sql`SELECT * FROM stripe.invoices WHERE customer = ${customerId} ORDER BY created DESC LIMIT ${limit}`
  );
  return result.rows as any[];
}

export async function getProPlanPrice() {
  const result = await db.execute(
    sql`
      SELECT pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring,
             p.id as product_id, p.name as product_name
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.name = 'SubTracker Pro' AND pr.active = true AND p.active = true
      LIMIT 1
    `
  );
  return (result.rows[0] as any) ?? null;
}

export async function updateUserStripeInfo(userId: string, info: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
}) {
  const [user] = await db
    .update(usersTable)
    .set({ ...info, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  return user;
}

export async function isGCSubscribed(userId: string): Promise<boolean> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "GC") return false;
  if (!user.stripeSubscriptionId) return false;

  const sub = await getSubscriptionById(user.stripeSubscriptionId);
  if (!sub) return false;

  const status = sub.status;
  if (status === "active" || status === "trialing") return true;

  if (status === "past_due") {
    const now = Math.floor(Date.now() / 1000);
    const gracePeriodEnd = (sub.current_period_end ?? 0) + 3 * 24 * 60 * 60;
    if (now <= gracePeriodEnd) return true;
  }

  return false;
}

export async function getGCProjectCount(gcId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM projects WHERE gc_id = ${gcId}`
  );
  return parseInt((result.rows[0] as any)?.count ?? "0", 10);
}
