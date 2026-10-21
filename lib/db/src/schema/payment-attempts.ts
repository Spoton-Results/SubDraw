import { pgTable, text, timestamp, bigint, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { invoicesTable, subcontractsTable } from "./subcontracts";
import { usersTable } from "./users";
export const paymentAttemptsTable = pgTable("stripe_payment_attempts", {
  invoiceId: text("invoice_id").primaryKey().references(() => invoicesTable.id),
  idempotencyKey: text("idempotency_key").notNull().unique("stripe_payment_attempt_key_unique"),
  subcontractId: text("subcontract_id").notNull().references(() => subcontractsTable.id),
  subId: text("sub_id").notNull().references(() => usersTable.id),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  initiatorId: text("initiator_id").notNull().references(() => usersTable.id),
  stripeAccountId: text("stripe_account_id").notNull(),
  baseCents: bigint("base_cents", { mode: "number" }).notNull(),
  feeCents: bigint("fee_cents", { mode: "number" }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique("stripe_payment_attempt_intent_unique"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [check("stripe_payment_attempt_amounts_check", sql`${t.baseCents} > 0 AND ${t.feeCents} >= 0 AND ${t.baseCents} + ${t.feeCents} <= 9007199254740991`)]);
