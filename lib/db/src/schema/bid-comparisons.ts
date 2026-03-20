import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const bidComparisonsTable = pgTable("bid_comparisons", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().unique().references(() => projectsTable.id, { onDelete: "cascade" }),
  levelingNotes: text("leveling_notes"),
  criteriaJson: text("criteria_json").default("[]").notNull(),
  scoresJson: text("scores_json").default("{}").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BidComparison = typeof bidComparisonsTable.$inferSelect;
