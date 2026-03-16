import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * External skill sources table
 * Tracks skills installed from external registries like skill.sh, GitHub, skillhub
 */
export const skillSources = pgTable(
  "skill_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    // The skill_registry entry this source maps to
    skillRegistryId: uuid("skill_registry_id").references(() => companies.id),
    // Source type: skillsh, skillhub, github, builtin
    sourceType: text("source_type").notNull(),
    // Full URL to the external source
    sourceUrl: text("source_url").notNull(),
    // External ID in the source system (e.g., skill slug, repo path)
    externalId: text("external_id"),
    // Skill metadata
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    // GitHub-specific fields
    githubOwner: text("github_owner"),
    githubRepo: text("github_repo"),
    githubPath: text("github_path"),
    githubBranch: text("github_branch").default("main"),
    // Version tracking
    version: text("version").notNull().default("1.0.0"),
    externalVersion: text("external_version"), // Version from external source
    author: text("author"),
    category: text("category"),
    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncStatus: text("sync_status").default("pending"), // pending, synced, error
    syncError: text("sync_error"),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint on company + source type + external ID
    companySourceUniqueIdx: uniqueIndex("skill_sources_company_source_uq").on(
      table.companyId,
      table.sourceType,
      table.externalId,
    ),
    // Index for listing by company
    companyIdx: index("skill_sources_company_idx").on(table.companyId),
    // Index for finding by skill registry entry
    skillRegistryIdx: index("skill_sources_registry_idx").on(table.skillRegistryId),
    // Index for sync status queries
    syncStatusIdx: index("skill_sources_sync_status_idx").on(table.syncStatus),
  }),
);
