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

export const issueWatchers = pgTable(
  "issue_watchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id),
    watcherType: text("watcher_type").notNull(),
    watcherId: text("watcher_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    watcherUniqueIdx: uniqueIndex("issue_watchers_issue_type_watcher_uq").on(
      table.issueId,
      table.watcherType,
      table.watcherId,
    ),
    companyIssueIdx: index("issue_watchers_company_issue_idx").on(
      table.companyId,
      table.issueId,
    ),
  }),
);
