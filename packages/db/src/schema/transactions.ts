import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { issues } from "./issues.js";
import { templateWorkflows } from "./template_workflows.js";

/**
 * Transactions - 事务
 * Core work tracking unit with role assignments and deliverables
 */
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),

  // Transaction identification
  code: text("code").notNull(), // e.g., "TRANS-001"
  type: text("type").notNull(), // feature, bugfix, project, task
  title: text("title").notNull(),
  description: text("description"),

  // Linked issue (optional)
  issueId: uuid("issue_id").references(() => issues.id),

  // Workflow
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => templateWorkflows.id),
  currentPhase: text("current_phase").notNull().default("init"),

  // Status
  status: text("status").notNull().default("active"), // active, completed, cancelled, blocked
  blockedReason: text("blocked_reason"),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),

  // Organizer (事务组织者)
  organizerAgentId: uuid("organizer_agent_id"), // Agent assigned as organizer
  organizerUserId: text("organizer_user_id"), // Human user as organizer

  // Phase timestamps
  phaseHistory: jsonb("phase_history").$type<Array<{
    phase: string;
    enteredAt: string;
    exitedAt?: string;
    enteredBy: string;
    approvedBy?: string;
  }>>().default([]),

  // Progress tracking
  progress: jsonb("progress").$type<{
    totalDeliverables: number;
    completedDeliverables: number;
    requiredRoles: number;
    assignedRoles: number;
    phaseProgress: Record<string, number>; // phase -> percentage
  }>().default({
    totalDeliverables: 0,
    completedDeliverables: 0,
    requiredRoles: 0,
    assignedRoles: 0,
    phaseProgress: {},
  }),

  // Auto-fix suggestions
  pendingSuggestions: jsonb("pending_suggestions").$type<Array<{
    id: string;
    type: string;
    description: string;
    confidence: number;
    autoApply: boolean;
    createdAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
  }>>().default([]),

  // Completion
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),

  // Audit
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Transaction Role Assignments - 事务角色分配
 * Links agents/users to roles in a transaction
 */
export const transactionRoleAssignments = pgTable("transaction_role_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),

  // Role assignment
  roleCode: text("role_code").notNull(), // e.g., "product_manager"
  roleName: text("role_name").notNull(),

  // Assignee (agent or human)
  agentId: uuid("agent_id"), // If assigned to an agent
  userId: text("user_id"), // If assigned to a human user

  // Assignment metadata
  assignedBy: text("assigned_by").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),

  // Status
  isActive: boolean("is_active").notNull().default(true),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  deactivatedReason: text("deactivated_reason"),

  // Deliverables for this role
  requiredDeliverables: jsonb("required_deliverables").$type<string[]>(), // List of deliverable type codes

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
