import { pgTable, uuid, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { projectWorkspaces } from "./project_workspaces.js";

export const workspaceAgents = pgTable(
  "workspace_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => projectWorkspaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    role: text("role").notNull().default("member"),
    permissions: text("permissions").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("workspace_agents_company_idx").on(table.companyId),
    workspaceIdx: index("workspace_agents_workspace_idx").on(table.workspaceId),
    agentIdx: index("workspace_agents_agent_idx").on(table.agentId),
    workspaceAgentUnique: unique("workspace_agents_workspace_agent_unique").on(table.workspaceId, table.agentId),
  }),
);
