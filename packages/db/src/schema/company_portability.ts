import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

/**
 * Company export history tracking
 */
export const companyExports = pgTable(
  "company_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    exportFormat: text("export_format").notNull().default("paperclip_bundle"),
    exportPath: text("export_path"),
    exportStatus: text("export_status").notNull().default("pending"),
    exportMetadata: jsonb("export_metadata").$type<Record<string, unknown>>(),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    companyIdx: index("company_exports_company_idx").on(table.companyId),
    statusIdx: index("company_exports_status_idx").on(table.exportStatus),
  }),
);

/**
 * Company import history tracking
 */
export const companyImports = pgTable(
  "company_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetCompanyId: uuid("target_company_id").references(() => companies.id, { onDelete: "cascade" }),
    importSource: text("import_source").notNull(), // path, url, github
    importSourceRef: text("import_source_ref"), // git ref or file path
    importStatus: text("import_status").notNull().default("pending"),
    importMode: text("import_mode").notNull().default("merge"), // merge, replace
    importMetadata: jsonb("import_metadata").$type<Record<string, unknown>>(),
    mergeStrategy: text("merge_strategy").default("preserve_history"),
    heartbeatDisabled: boolean("heartbeat_disabled").default(true),
    importedAgentsCount: text("imported_agents_count").default("0"),
    importedIssuesCount: text("imported_issues_count").default("0"),
    importedSkillsCount: text("imported_skills_count").default("0"),
    error: text("error"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    targetIdx: index("company_imports_target_idx").on(table.targetCompanyId),
    statusIdx: index("company_imports_status_idx").on(table.importStatus),
  }),
);
