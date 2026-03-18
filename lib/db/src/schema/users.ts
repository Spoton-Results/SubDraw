import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // GC | SUB
  companyName: text("company_name").notNull(),
  displayName: text("display_name"), // For GC team members: their full personal name (e.g. "Mike Johnson")
  gcParentId: text("gc_parent_id"), // For GC team members: the owning GC account's userId
  gcTeamRole: text("gc_team_role"), // "owner" | "project_manager" — null means legacy GC (treated as owner)
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialStartedAt: timestamp("trial_started_at").defaultNow().notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
