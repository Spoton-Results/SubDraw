import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const demoLeadsTable = pgTable("demo_leads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firstName: text("first_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // "GC" | "SUB"
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
  sessionId: text("session_id"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
});

export type DemoLead = typeof demoLeadsTable.$inferSelect;
