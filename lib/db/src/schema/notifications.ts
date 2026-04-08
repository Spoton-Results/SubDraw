import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url"),
  data: text("data"),
  readAt: timestamp("read_at"),
  pushSent: boolean("push_sent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  // GC preferences
  invoiceSubmitted: boolean("invoice_submitted").notNull().default(true),
  invoiceFlagged: boolean("invoice_flagged").notNull().default(true),
  changeOrderApproved: boolean("change_order_approved").notNull().default(true),
  changeOrderRejected: boolean("change_order_rejected").notNull().default(true),
  changeOrderRequest: boolean("change_order_request").notNull().default(true),
  paymentConfirmed: boolean("payment_confirmed").notNull().default(true),
  paymentDisputed: boolean("payment_disputed").notNull().default(true),
  insuranceExpiring: boolean("insurance_expiring").notNull().default(true),
  licenseExpiring: boolean("license_expiring").notNull().default(true),
  // Sub preferences
  changeOrderCreated: boolean("change_order_created").notNull().default(true),
  invoiceApproved: boolean("invoice_approved").notNull().default(true),
  invoiceRejected: boolean("invoice_rejected").notNull().default(true),
  paymentStripe: boolean("payment_stripe").notNull().default(true),
  paymentManual: boolean("payment_manual").notNull().default(true),
  submittalReceived: boolean("submittal_received").notNull().default(true),
  submittalOverdue: boolean("submittal_overdue").notNull().default(true),
  paymentSetupReminder: boolean("payment_setup_reminder").notNull().default(true),
  stripeAccountActive: boolean("stripe_account_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
