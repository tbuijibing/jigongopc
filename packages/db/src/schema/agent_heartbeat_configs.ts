import {
  pgTable,
  uuid,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentHeartbeatConfigs = pgTable(
  "agent_heartbeat_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    enabled: boolean("enabled").notNull().default(true),
    intervalSec: integer("interval_sec").notNull().default(300),
    wakeOnAssignment: boolean("wake_on_assignment").notNull().default(true),
    wakeOnMention: boolean("wake_on_mention").notNull().default(true),
    wakeOnDemand: boolean("wake_on_demand").notNull().default(true),
    maxConcurrentRuns: integer("max_concurrent_runs").notNull().default(1),
    timeoutSec: integer("timeout_sec").notNull().default(600),
    cooldownSec: integer("cooldown_sec").notNull().default(60),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentUniqueIdx: uniqueIndex("agent_heartbeat_configs_company_agent_uq").on(
      table.companyId,
      table.agentId,
    ),
    companyIdx: index("agent_heartbeat_configs_company_idx").on(table.companyId),
  }),
);
