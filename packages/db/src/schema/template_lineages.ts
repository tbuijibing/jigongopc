import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  decimal,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { companyTemplates } from "./company_templates.js";

/**
 * Template Lineages - 模板谱系追踪
 * Tracks fork relationships and contribution metrics for revenue sharing
 */
export const templateLineages = pgTable("template_lineages", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .unique()
    .references(() => companyTemplates.id, { onDelete: "cascade" }),

  // Ancestry info
  rootTemplateId: uuid("root_template_id")
    .notNull()
    .references(() => companyTemplates.id),
  parentTemplateId: uuid("parent_template_id").references(
    () => companyTemplates.id
  ),
  generation: integer("generation").notNull().default(0), // Fork generation

  // Parent template info (simplified ancestor chain)
  parentInfo: jsonb("parent_info").$type<{
    creatorId?: string;
    creatorName?: string;
    forkedAt?: string;
    contribution?: string;
  }>(),

  // Statistics
  forkCount: integer("fork_count").notNull().default(0),
  directUsageCount: integer("direct_usage_count").notNull().default(0),
  totalRevenueGenerated: decimal("total_revenue_generated", {
    precision: 19,
    scale: 4,
  }).notNull().default("0"),

  // Contribution scoring (0-100)
  originalityScore: integer("originality_score"), // Originality rating

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
