import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminCallLogsTable = pgTable("admin_call_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  gcUserId: text("gc_user_id").notNull(),
  action: text("action").notNull(), // "called" | "dismissed"
  reason: text("reason"),
  adminEmail: text("admin_email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminCallLog = typeof adminCallLogsTable.$inferSelect;

export const adminImpersonationLogsTable = pgTable("admin_impersonation_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  adminEmail: text("admin_email").notNull(),
  gcUserId: text("gc_user_id").notNull(),
  gcCompanyName: text("gc_company_name").notNull(),
  gcEmail: text("gc_email").notNull(),
  ipAddress: text("ip_address"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export type AdminImpersonationLog = typeof adminImpersonationLogsTable.$inferSelect;
