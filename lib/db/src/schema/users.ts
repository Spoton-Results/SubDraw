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
  gcTeamRole: text("gc_team_role"), // "owner"|"vp_operations"|"project_manager"|"project_engineer"|"superintendent"|"estimator"|"contract_administrator"|"accountant" — null means legacy GC (treated as owner)
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialStartedAt: timestamp("trial_started_at").defaultNow().notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  passwordChangedAt: timestamp("password_changed_at"),
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeConnectPayoutsEnabled: boolean("stripe_connect_payouts_enabled").notNull().default(false),
  pausedAt: timestamp("paused_at"),
  lastLoginAt: timestamp("last_login_at"),
  adminPlanOverride: text("admin_plan_override"),
  adminPlanOverrideExpiresAt: timestamp("admin_plan_override_expires_at"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
