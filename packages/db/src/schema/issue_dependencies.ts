import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const issueDependencies = pgTable(
  "issue_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id),
    dependsOnIssueId: uuid("depends_on_issue_id").notNull().references(() => issues.id),
    dependencyType: text("dependency_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    issueDepUniqueIdx: uniqueIndex("issue_dependencies_issue_depends_on_uq").on(
      table.issueId,
      table.dependsOnIssueId,
    ),
    companyIssueIdx: index("issue_dependencies_company_issue_idx").on(
      table.companyId,
      table.issueId,
    ),
    companyDependsOnIdx: index("issue_dependencies_company_depends_on_idx").on(
      table.companyId,
      table.dependsOnIssueId,
    ),
  }),
);
