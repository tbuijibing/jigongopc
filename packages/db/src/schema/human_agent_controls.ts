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

export const humanAgentControls = pgTable(
  "human_agent_controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    isPrimary: boolean("is_primary").notNull().default(false),
    permissions: jsonb("permissions").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userAgentUniqueIdx: uniqueIndex("human_agent_controls_user_agent_uq").on(
      table.userId,
      table.agentId,
    ),
    companyUserIdx: index("human_agent_controls_company_user_idx").on(
      table.companyId,
      table.userId,
    ),
    companyAgentIdx: index("human_agent_controls_company_agent_idx").on(
      table.companyId,
      table.agentId,
    ),
  }),
);
