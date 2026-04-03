import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const demoClicksTable = pgTable("demo_clicks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: text("event_type").notNull(), // GC_DEMO | SUB_DEMO
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pageViewsTable = pgTable("page_views", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  path: text("path").notNull(),
  isAuthenticated: boolean("is_authenticated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
