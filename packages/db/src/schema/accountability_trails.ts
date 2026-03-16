import {
  type AnyPgColumn,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { transactions } from "./transactions.js";
import { transactionDeliverables } from "./transaction_deliverables.js";

/**
 * Accountability Trails - 责任追溯
 * Complete audit trail of who did what when
 */
export const accountabilityTrails = pgTable("accountability_trails", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),

  // Event classification
  eventType: text("event_type").notNull(), // deliverable_submitted, phase_transitioned, decision_made, etc.
  eventCode: text("event_code"), // e.g., "SUBMIT_PRD", "APPROVE_DESIGN"

  // Actor
  actorType: text("actor_type").notNull(), // agent, user, system
  actorId: text("actor_id").notNull(), // Agent ID or User ID
  actorName: text("actor_name").notNull(), // Human-readable name
  actorRole: text("actor_role"), // Role code at time of event

  // Action details
  action: text("action").notNull(), // e.g., "created", "updated", "approved", "rejected"
  resourceType: text("resource_type").notNull(), // deliverable, transaction, phase, etc.
  resourceId: text("resource_id").notNull(),
  resourceName: text("resource_name"), // Human-readable name

  // Context
  context: jsonb("context").$type<{
    phase?: string;
    deliverableCode?: string;
    previousState?: string;
    newState?: string;
    metadata?: Record<string, unknown>;
  }>(),

  // Reason/justification
  reason: text("reason"), // Why this action was taken
  justification: text("justification"), // Business justification

  // Evidence
  evidence: jsonb("evidence").$type<{
    commitSha?: string;
    prNumber?: number;
    filePath?: string;
    screenshotUrl?: string;
    attachmentIds?: string[];
  }>(),

  // Impact
  impact: jsonb("impact").$type<{
    blockedTransactions?: string[];
    affectedDeliverables?: string[];
    downstreamEffects?: string[];
  }>(),

  // Chain
  parentEventId: uuid("parent_event_id").references((): AnyPgColumn => accountabilityTrails.id),
  chainDepth: integer("chain_depth").notNull().default(0),

  // Timestamp
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Transaction Timeline - 事务时间线
 * Aggregated view of all events for a transaction
 */
export const transactionTimelines = pgTable("transaction_timelines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),

  // Timeline entry
  entryType: text("entry_type").notNull(), // phase_change, deliverable_status, decision, block, unblock
  entryData: jsonb("entry_data").notNull(),

  // Display
  displayOrder: integer("display_order").notNull(),
  isMilestone: boolean("is_milestone").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
