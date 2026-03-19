import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { changeOrdersTable } from "./subcontracts";

export const ownerCoNotificationsTable = pgTable("owner_co_notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  changeOrderId: text("change_order_id").notNull().references(() => changeOrdersTable.id),
  notificationToken: text("notification_token").notNull().unique(),
  ownerName: text("owner_name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  ownerResponse: text("owner_response"), // null | APPROVED | REJECTED
  ownerResponseNote: text("owner_response_note"),
  ownerResponseAt: timestamp("owner_response_at"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OwnerCoNotification = typeof ownerCoNotificationsTable.$inferSelect;
