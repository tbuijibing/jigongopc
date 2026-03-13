import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentMemories = pgTable(
  "agent_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    memoryLayer: text("memory_layer").notNull(),
    scopeId: uuid("scope_id"),
    key: text("key").notNull(),
    value: text("value").notNull(),
    memoryType: text("memory_type").notNull(),
    importance: integer("importance").notNull().default(50),
    accessCount: integer("access_count").notNull().default(0),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentLayerScopeIdx: index("agent_memories_company_agent_layer_scope_idx").on(
      table.companyId,
      table.agentId,
      table.memoryLayer,
      table.scopeId,
    ),
    companyAgentKeyIdx: index("agent_memories_company_agent_key_idx").on(
      table.companyId,
      table.agentId,
      table.key,
    ),
  }),
);
