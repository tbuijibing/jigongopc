import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentSouls = pgTable(
  "agent_souls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    systemPrompt: text("system_prompt").notNull(),
    personality: text("personality"),
    constraints: text("constraints"),
    outputFormat: text("output_format"),
    language: text("language").notNull().default("en"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentUniqueIdx: uniqueIndex("agent_souls_company_agent_uq").on(
      table.companyId,
      table.agentId,
    ),
    companyIdx: index("agent_souls_company_idx").on(table.companyId),
  }),
);
