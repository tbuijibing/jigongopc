import {
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

/**
 * Retrospectives - 复盘记录
 * Captures lessons learned and improvement opportunities
 */
export const retrospectives = pgTable("retrospectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),

  // Retrospective status
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, archived

  // Data collection
  whatWentWell: text("what_went_well").array(), // List of positive observations
  whatWentWrong: text("what_went_wrong").array(), // List of issues
  whatToImprove: text("what_to_improve").array(), // List of improvement ideas

  // Metrics
  metrics: jsonb("metrics").$type<{
    durationEstimateAccuracy?: number; // Estimated vs actual
    deliverableCompletionRate?: number;
    roleSatisfaction?: Record<string, number>; // role -> satisfaction score
    blockerFrequency?: number;
    autoFixSuccessRate?: number;
  }>(),

  // Analysis
  analysis: jsonb("analysis").$type<{
    rootCauses: Array<{
      issue: string;
      cause: string;
      category: string;
    }>;
    patterns: string[];
    recommendations: Array<{
      description: string;
      impact: "high" | "medium" | "low";
      effort: "high" | "medium" | "low";
    }>;
  }>(),

  // Template evolution suggestions
  templateImprovements: jsonb("template_improvements").$type<Array<{
    type: "workflow" | "role" | "deliverable" | "rule";
    target: string; // e.g., "feature_dev", "product_manager"
    currentIssue: string;
    proposedChange: string;
    rationale: string;
    confidence: number;
    autoApply: boolean;
    appliedAt?: string;
    appliedBy?: string;
  }>>().default([]),

  // Action items
  actionItems: jsonb("action_items").$type<Array<{
    id: string;
    description: string;
    assignee: string;
    dueDate: string;
    status: "open" | "in_progress" | "completed" | "cancelled";
    priority: "high" | "medium" | "low";
    createdAt: string;
    completedAt?: string;
  }>>().default([]),

  // Participants
  participants: text("participants").array(), // Agent IDs or user IDs
  conductedBy: text("conducted_by"), // Who led the retrospective

  // Scheduling
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  conductedAt: timestamp("conducted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // AI-generated summary
  aiSummary: text("ai_summary"),
  aiInsights: jsonb("ai_insights").$type<{
    keyThemes: string[];
    riskAreas: string[];
    opportunities: string[];
    similarTransactions?: string[];
  }>(),

  // Audit
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Retrospective Patterns - 复盘模式库
 * Common patterns identified across multiple retrospectives
 */
export const retrospectivePatterns = pgTable("retrospective_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  // Pattern identification
  patternCode: text("pattern_code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // positive, negative, neutral

  // Matching rules
  matchingRules: jsonb("matching_rules").$type<{
    keywords: string[];
    sentimentIndicators: string[];
    metricThresholds: Record<string, { min?: number; max?: number }>;
    phasePatterns: string[];
  }>(),

  // Statistics
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),

  // Related transactions
  relatedTransactionIds: uuid("related_transaction_ids").array(),

  // Suggested actions
  suggestedActions: jsonb("suggested_actions").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Template Evolution Log - 模板演进日志
 * Records changes made to templates based on retrospectives
 */
export const templateEvolutionLogs = pgTable("template_evolution_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  // Change identification
  changeType: text("change_type").notNull(), // workflow_update, role_update, rule_addition, etc.
  targetTemplateId: uuid("target_template_id").notNull(),

  // Source
  sourceType: text("source_type").notNull(), // retrospective, manual, import, ai_suggestion
  sourceId: uuid("source_id"), // e.g., retrospective ID

  // Change details
  changeDescription: text("change_description").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),

  // Impact
  affectedTransactions: integer("affected_transactions").notNull().default(0),
  expectedImprovement: text("expected_improvement"),

  // Rollback
  canRollback: boolean("can_rollback").notNull().default(true),
  rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
  rollbackReason: text("rollback_reason"),

  // Approval
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
