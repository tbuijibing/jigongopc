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
import { companyTemplates } from "./company_templates.js";

/**
 * Template Workflows - 模板工作流定义
 * Defines workflows extracted from company templates
 */
export const templateWorkflows = pgTable("template_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => companyTemplates.id, { onDelete: "cascade" }),

  // Workflow identification
  code: text("code").notNull(), // e.g., "feature_dev", "bug_fix"
  name: text("name").notNull(),
  description: text("description"),

  // Workflow definition
  definition: jsonb("definition").$type<{
    applicableTo: {
      issueTypes?: string[];
      labels?: string[];
      projectTypes?: string[];
    };
    phases: Array<{
      code: string;
      name: string;
      order: number;
      requiredDeliverables: string[]; // deliverable type codes
      autoTransitionRules: Array<{
        condition: string;
        targetPhase: string;
        confidenceThreshold: number;
      }>;
      blockingRules: Array<{
        type: string;
        message: string;
        severity: "block" | "warn";
      }>;
    }>;
    transitions: Array<{
      from: string;
      to: string;
      requiresApproval: boolean;
      approverRoles?: string[];
    }>;
  }>(),

  // Status
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Template Roles - 模板角色定义
 * Defines roles within a template
 */
export const templateRoles = pgTable("template_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => companyTemplates.id, { onDelete: "cascade" }),

  // Role identification
  code: text("code").notNull(), // e.g., "product_manager", "tech_lead"
  name: text("name").notNull(),
  description: text("description"),

  // Role definition
  definition: jsonb("definition").$type<{
    responsibilities: string[];
    permissions: string[];
    deliverableTypes: Array<{
      code: string;
      name: string;
      required: boolean;
      templatePath?: string;
      validationRules: Array<{
        type: string;
        config: Record<string, unknown>;
      }>;
    }>;
    agentBehavior: {
      promptContext: string;
      decisionRules: string[];
      escalationTriggers: string[];
    };
  }>(),

  // Status
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Project Template Assignments - 项目模板分配
 * Assigns templates to projects with customizations
 */
export const projectTemplateAssignments = pgTable("project_template_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => companyTemplates.id, { onDelete: "cascade" }),

  // Customization overrides
  variableOverrides: jsonb("variable_overrides").$type<Record<string, unknown>>(),
  disabledWorkflows: text("disabled_workflows").array(),
  customWorkflows: jsonb("custom_workflows").$type<unknown[]>(),

  // Assignment metadata
  isActive: boolean("is_active").notNull().default(true),
  assignedBy: text("assigned_by").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
