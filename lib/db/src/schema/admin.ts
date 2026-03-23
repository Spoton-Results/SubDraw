import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
