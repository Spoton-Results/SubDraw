import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const gcProjectAssignmentsTable = pgTable("gc_project_assignments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id),
  teamMemberUserId: text("team_member_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
