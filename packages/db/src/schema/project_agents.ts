import { pgTable, uuid, timestamp, index, text } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

/**
 * Project-Agents Many-to-Many Relationship Table
 * 
 * Allows a project to be bound to multiple agents, and an agent to be assigned to multiple projects.
 * This extends beyond the single lead_agent_id on projects table to support team-based agent collaboration.
 */
export const projectAgents = pgTable(
  "project_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // "lead", "member", "observer"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("project_agents_project_idx").on(table.projectId),
    agentIdx: index("project_agents_agent_idx").on(table.agentId),
    uniqueProjectAgent: index("project_agents_unique_idx").on(table.projectId, table.agentId),
  }),
);
