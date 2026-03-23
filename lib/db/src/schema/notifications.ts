import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: text("data"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
