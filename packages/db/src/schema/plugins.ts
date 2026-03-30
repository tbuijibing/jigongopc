import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

/**
 * Plugin registry - installed plugins
 */
export const plugins = pgTable(
  "plugins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    version: text("version").notNull(),
    description: text("description"),
    author: text("author"),
    manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("inactive"), // inactive, active, error
    error: text("error"),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: index("plugins_company_slug_idx").on(table.companyId, table.slug),
    companyStatusIdx: index("plugins_company_status_idx").on(table.companyId, table.status),
  }),
);

/**
 * Plugin configuration
 */
export const pluginConfig = pgTable(
  "plugin_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    configKey: text("config_key").notNull(),
    configValue: jsonb("config_value").$type<Record<string, unknown>>(),
    isSecret: boolean("is_secret").default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginKeyIdx: index("plugin_config_plugin_key_idx").on(table.pluginId, table.configKey),
    companyIdx: index("plugin_config_company_idx").on(table.companyId),
  }),
);

/**
 * Plugin persistent state
 */
export const pluginState = pgTable(
  "plugin_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    stateKey: text("state_key").notNull(),
    stateValue: jsonb("state_value").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginKeyIdx: index("plugin_state_plugin_key_idx").on(table.pluginId, table.stateKey),
    companyIdx: index("plugin_state_company_idx").on(table.companyId),
  }),
);

/**
 * Plugin entities - custom entity types defined by plugins
 */
export const pluginEntities = pgTable(
  "plugin_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityData: jsonb("entity_data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginTypeIdx: index("plugin_entities_plugin_type_idx").on(table.pluginId, table.entityType),
    companyIdx: index("plugin_entities_company_idx").on(table.companyId),
  }),
);

/**
 * Plugin jobs - scheduled or queued jobs
 */
export const pluginJobs = pgTable(
  "plugin_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    jobType: text("job_type").notNull(),
    jobStatus: text("job_status").notNull().default("pending"), // pending, running, completed, failed
    priority: integer("priority").default(0),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginStatusIdx: index("plugin_jobs_plugin_status_idx").on(table.pluginId, table.jobStatus),
    scheduledIdx: index("plugin_jobs_scheduled_idx").on(table.scheduledAt),
  }),
);

export const pluginJobRuns = pgTable(
  "plugin_job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => pluginJobs.id, { onDelete: "cascade" }),
    runStatus: text("run_status").notNull(),
    log: text("log"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("plugin_job_runs_job_idx").on(table.jobId),
  }),
);

/**
 * Plugin webhooks
 */
export const pluginWebhookDeliveries = pgTable(
  "plugin_webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    webhookUrl: text("webhook_url").notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginIdx: index("plugin_webhook_deliveries_plugin_idx").on(table.pluginId),
    eventIdx: index("plugin_webhook_deliveries_event_idx").on(table.event),
  }),
);

/**
 * Plugin logs
 */
export const pluginLogs = pgTable(
  "plugin_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    level: text("level").notNull(), // debug, info, warn, error
    message: text("message").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginLevelIdx: index("plugin_logs_plugin_level_idx").on(table.pluginId, table.level),
    createdAtIdx: index("plugin_logs_created_at_idx").on(table.createdAt),
  }),
);
