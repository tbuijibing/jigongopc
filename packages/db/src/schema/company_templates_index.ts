import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { companyTemplates } from "./company_templates.js";
import { templateWorkflows } from "./template_workflows.js";

/**
 * Template Workflow Nodes - 模板工作流节点
 * Stores individual nodes within a workflow definition
 */
export const templateWorkflowNodes = pgTable(
  "template_workflow_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => companyTemplates.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => templateWorkflows.id, { onDelete: "cascade" }),

    // Node identification
    code: text("code").notNull(), // e.g., "start", "review", "approval", "end"
    name: text("name").notNull(),
    description: text("description"),

    // Node type and configuration
    nodeType: text("node_type").notNull(), // start, end, task, decision, approval, parallel, join
    nodeConfig: jsonb("node_config").$type<{
      // Task node config
      assigneeRole?: string;
      autoAssign?: boolean;
      timeoutMinutes?: number;
      // Decision node config
      conditions?: Array<{
        field: string;
        operator: string;
        value: unknown;
        targetNode: string;
      }>;
      // Approval node config
      approverRoles?: string[];
      minApprovals?: number;
      // Parallel node config
      parallelBranches?: number;
      // General config
      formFields?: Array<{
        name: string;
        type: string;
        required: boolean;
        validation?: Record<string, unknown>;
      }>;
    }>(),

    // Position in workflow (for visual layout)
    positionX: integer("position_x"),
    positionY: integer("position_y"),

    // Node metadata
    displayOrder: integer("display_order").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(true),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("template_workflow_nodes_company_idx").on(table.companyId),
    templateIdx: index("template_workflow_nodes_template_idx").on(table.templateId),
    workflowIdx: index("template_workflow_nodes_workflow_idx").on(table.workflowId),
    codeIdx: index("template_workflow_nodes_code_idx").on(table.workflowId, table.code),
  })
);

/**
 * Template Workflow Edges - 模板工作流连线
 * Defines connections between workflow nodes
 */
export const templateWorkflowEdges = pgTable(
  "template_workflow_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => companyTemplates.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => templateWorkflows.id, { onDelete: "cascade" }),

    // Edge connection
    sourceNodeId: uuid("source_node_id")
      .notNull()
      .references(() => templateWorkflowNodes.id, { onDelete: "cascade" }),
    targetNodeId: uuid("target_node_id")
      .notNull()
      .references(() => templateWorkflowNodes.id, { onDelete: "cascade" }),

    // Edge type and condition
    edgeType: text("edge_type").notNull().default("default"), // default, conditional, timeout, error
    condition: jsonb("condition").$type<{
      type: string; // always, expression, outcome, timeout
      expression?: string;
      expectedOutcome?: string;
      timeoutMinutes?: number;
    }>(),

    // Edge metadata
    label: text("label"),
    priority: integer("priority").notNull().default(0),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("template_workflow_edges_company_idx").on(table.companyId),
    templateIdx: index("template_workflow_edges_template_idx").on(table.templateId),
    workflowIdx: index("template_workflow_edges_workflow_idx").on(table.workflowId),
    sourceIdx: index("template_workflow_edges_source_idx").on(table.sourceNodeId),
    targetIdx: index("template_workflow_edges_target_idx").on(table.targetNodeId),
  })
);

/**
 * Template Snapshots - 模板快照
 * Versioned snapshots of templates at specific points in time
 */
export const templateSnapshots = pgTable(
  "template_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => companyTemplates.id, { onDelete: "cascade" }),

    // Snapshot identification
    version: text("version").notNull(),
    name: text("name").notNull(),
    description: text("description"),

    // Snapshot content
    snapshotData: jsonb("snapshot_data").$type<{
      template: Record<string, unknown>;
      workflows: Record<string, unknown>[];
      roles: Record<string, unknown>[];
      nodes: Record<string, unknown>[];
      edges: Record<string, unknown>[];
    }>().notNull(),

    // Snapshot metadata
    snapshotType: text("snapshot_type").notNull().default("manual"), // manual, auto, pre_publish, pre_update
    createdBy: text("created_by").notNull(),

    // Source info (if created from a transaction/retrospective)
    sourceType: text("source_type"), // transaction, retrospective, manual
    sourceId: text("source_id"),

    // Usage tracking
    isRestored: boolean("is_restored").notNull().default(false),
    restoredAt: timestamp("restored_at", { withTimezone: true }),
    restoredBy: text("restored_by"),

    // Checksum for integrity
    checksum: text("checksum"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("template_snapshots_company_idx").on(table.companyId),
    templateIdx: index("template_snapshots_template_idx").on(table.templateId),
    versionIdx: index("template_snapshots_version_idx").on(table.templateId, table.version),
  })
);
