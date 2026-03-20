import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const gcProjectCredentialsTable = pgTable("gc_project_credentials", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().unique().references(() => projectsTable.id, { onDelete: "cascade" }),

  // Insurance Certificate
  insCompany: text("ins_company"),
  insPolicyNumber: text("ins_policy_number"),
  insGLCoverage: text("ins_gl_coverage"),
  insWCCoverage: text("ins_wc_coverage"),
  insExpDate: text("ins_exp_date"),
  insCertPath: text("ins_cert_path"),
  insNotifiedAt30: timestamp("ins_notified_at_30"),
  insNotifiedAt7: timestamp("ins_notified_at_7"),

  // Contractor License
  licNumber: text("lic_number"),
  licType: text("lic_type"),
  licState: text("lic_state"),
  licExpDate: text("lic_exp_date"),
  licDocPath: text("lic_doc_path"),
  licNotifiedAt30: timestamp("lic_notified_at_30"),
  licNotifiedAt7: timestamp("lic_notified_at_7"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GcProjectCredentials = typeof gcProjectCredentialsTable.$inferSelect;
