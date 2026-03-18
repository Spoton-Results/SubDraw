import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const magicLinkTokensTable = pgTable("magic_link_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MagicLinkToken = typeof magicLinkTokensTable.$inferSelect;
