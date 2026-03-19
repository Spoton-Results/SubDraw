import { pgTable, text, timestamp, bigint, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectCompletionDocumentsTable = pgTable("project_completion_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  fileSize: bigint("file_size", { mode: "number" }),
  category: text("category").notNull().default("document"),
  label: text("label"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProjectCompletionDocument = typeof projectCompletionDocumentsTable.$inferSelect;
