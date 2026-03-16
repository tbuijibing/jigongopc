import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Company Operating Templates - 公司运行模板
 * Stores template packages that define company workflows, roles, and rules
 */
export const companyTemplates = pgTable("company_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  // Template metadata
  name: text("name").notNull(),
  slug: text("slug").notNull(), // URL-friendly identifier
  description: text("description"),
  version: text("version").notNull().default("1.0.0"),

  // Template source info
  sourceType: text("source_type").notNull().default("builtin"), // builtin, imported, marketplace, forked
  parentTemplateId: uuid("parent_template_id"), // For template inheritance

  // Template content (encrypted for marketplace templates)
  templatePackage: jsonb("template_package").$type<{
    manifest: {
      apiVersion: string;
      kind: string;
      metadata: {
        name: string;
        version: string;
        author?: string;
        category?: string;
        encrypted?: boolean;
      };
    };
    core: {
      // Encrypted layer - core workflows and rules
      encrypted: boolean;
      encryptedData?: string; // If encrypted
      data?: {
        workflows: unknown[];
        globalRules: unknown;
        checks: unknown[];
      };
    };
    customization: {
      // Open layer - customizable variables
      variables: Record<string, unknown>;
      integrations: Record<string, unknown>;
      notifications: Record<string, unknown>;
    };
    roles: unknown[];
    agentBehaviors: Record<string, unknown>;
  }>(),

  // Encryption settings
  encryptionConfig: jsonb("encryption_config").$type<{
    enabled: boolean;
    algorithm: string;
    keyId: string;
    signature: string;
    customizableFields: string[];
  }>(),

  // Activation status
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false), // Default template for new projects

  // Marketplace info
  isPublic: boolean("is_public").notNull().default(false),
  shareCode: text("share_code"), // Code for importing
  downloadCount: integer("download_count").notNull().default(0),

  // Audit
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Template Subscriptions - 模板订阅
 * Companies can subscribe to templates for updates
 */
export const templateSubscriptions = pgTable("template_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => companyTemplates.id, { onDelete: "cascade" }),

  // Subscription settings
  autoUpdate: boolean("auto_update").notNull().default(false),
  updateChannel: text("update_channel").notNull().default("stable"), // stable, beta, alpha

  // Fork settings (for customization)
  isForked: boolean("is_forked").notNull().default(false),
  forkedFromId: uuid("forked_from_id").references(() => companyTemplates.id),
  customizations: jsonb("customizations").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Template Marketplace - 模板市场
 * Public templates shared between companies
 */
export const templateMarketplace = pgTable("template_marketplace", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => companyTemplates.id, { onDelete: "cascade" }),

  // Publishing info
  status: text("status").notNull().default("pending"), // pending, approved, rejected, published
  publishedAt: timestamp("published_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),

  // Metadata
  category: text("category").notNull().default("general"),
  tags: text("tags").array(),
  rating: integer("rating"), // 1-5 stars
  reviewCount: integer("review_count").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
