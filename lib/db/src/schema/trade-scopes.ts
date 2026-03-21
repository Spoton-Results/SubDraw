import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const tradeScopesTable = pgTable("trade_scopes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  tradeCategory: text("trade_category").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scopeTemplatesTable = pgTable("scope_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  gcId: text("gc_id").notNull().references(() => usersTable.id),
  tradeCategory: text("trade_category").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TradeScope = typeof tradeScopesTable.$inferSelect;
export type ScopeTemplate = typeof scopeTemplatesTable.$inferSelect;
