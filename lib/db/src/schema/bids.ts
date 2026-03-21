import { pgTable, text, timestamp, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const bidsTable = pgTable("bids", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  subId: text("sub_id").notNull().references(() => usersTable.id),
  amount: doublePrecision("amount").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("PENDING"), // PENDING | AWARDED | REJECTED
  scopeOfWorkObjectPath: text("scope_of_work_object_path"),
  scopeAcknowledged: boolean("scope_acknowledged").default(false).notNull(),
  scopeAcknowledgedAt: timestamp("scope_acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bidsTable.$inferSelect;
