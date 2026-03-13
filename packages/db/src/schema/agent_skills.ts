import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { skillRegistry } from "./skill_registry.js";

export const agentSkills = pgTable(
  "agent_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    skillId: uuid("skill_id").notNull().references(() => skillRegistry.id),
    installType: text("install_type").notNull(),
    installedBy: text("installed_by"),
    config: jsonb("config").$type<Record<string, unknown> | null>(),
    enabled: boolean("enabled").notNull().default(true),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentSkillUniqueIdx: uniqueIndex("agent_skills_company_agent_skill_uq").on(
      table.companyId,
      table.agentId,
      table.skillId,
    ),
    companyAgentIdx: index("agent_skills_company_agent_idx").on(
      table.companyId,
      table.agentId,
    ),
  }),
);
