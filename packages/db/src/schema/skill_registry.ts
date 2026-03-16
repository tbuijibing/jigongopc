import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const skillRegistry = pgTable(
  "skill_registry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    content: text("content").notNull(),
    category: text("category").notNull(),
    version: text("version").notNull().default("1.0.0"),
    author: text("author"),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    // Source tracking for external skills
    sourceType: text("source_type"), // skillsh, skillhub, github, null for manual
    sourceUrl: text("source_url"),
    externalId: text("external_id"), // ID in external system
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugUniqueIdx: uniqueIndex("skill_registry_company_slug_uq").on(
      table.companyId,
      table.slug,
    ),
    companyIdx: index("skill_registry_company_idx").on(table.companyId),
  }),
);
