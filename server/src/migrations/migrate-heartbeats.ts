import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, agentHeartbeatConfigs } from "@jigongai/db";

/**
 * Migrate Heartbeat data from agents.runtimeConfig.heartbeat → agent_heartbeat_configs table.
 *
 * - Reads all agents
 * - For agents with runtimeConfig.heartbeat, extracts those values
 * - For agents without heartbeat config, creates default config
 * - Inserts into agent_heartbeat_configs (skips agents that already have a record)
 * - Does NOT delete the original runtimeConfig (kept for fallback)
 * - Returns migration stats
 */
export async function migrateHeartbeats(db: Db) {
  let migrated = 0;
  let skipped = 0;

  // Fetch ALL agents (not just those with runtimeConfig)
  const allAgents = await db
    .select({
      id: agents.id,
      companyId: agents.companyId,
      runtimeConfig: agents.runtimeConfig,
    })
    .from(agents);

  for (const agent of allAgents) {
    // Check if agent_heartbeat_configs record already exists
    const existing = await db
      .select({ id: agentHeartbeatConfigs.id })
      .from(agentHeartbeatConfigs)
      .where(
        and(
          eq(agentHeartbeatConfigs.companyId, agent.companyId),
          eq(agentHeartbeatConfigs.agentId, agent.id),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (existing) {
      skipped++;
      continue;
    }

    // Extract heartbeat config if it exists
    let heartbeat: Record<string, unknown> | null = null;
    const config = agent.runtimeConfig;
    if (
      typeof config === "object" &&
      config !== null &&
      !Array.isArray(config) &&
      isPlainObject((config as Record<string, unknown>).heartbeat)
    ) {
      heartbeat = (config as Record<string, unknown>).heartbeat as Record<string, unknown>;
    }

    // Create heartbeat config (using defaults if no config exists)
    const now = new Date();
    await db.insert(agentHeartbeatConfigs).values({
      companyId: agent.companyId,
      agentId: agent.id,
      enabled: heartbeat ? toBool(heartbeat.enabled, true) : true,
      intervalSec: heartbeat ? toInt(heartbeat.intervalSec, 300) : 300,
      wakeOnAssignment: heartbeat ? toBool(heartbeat.wakeOnAssignment, true) : true,
      wakeOnMention: heartbeat ? toBool(heartbeat.wakeOnMention, true) : true,
      wakeOnDemand: heartbeat
        ? toBool(
            heartbeat.wakeOnDemand ?? heartbeat.wakeOnAssignment ?? heartbeat.wakeOnOnDemand ?? heartbeat.wakeOnAutomation,
            true,
          )
        : true,
      maxConcurrentRuns: heartbeat ? toInt(heartbeat.maxConcurrentRuns, 1) : 1,
      timeoutSec: heartbeat ? toInt(heartbeat.timeoutSec, 600) : 600,
      cooldownSec: heartbeat ? toInt(heartbeat.cooldownSec, 60) : 60,
      createdAt: now,
      updatedAt: now,
    });

    migrated++;
  }

  console.log(
    `[migrate-heartbeats] done — migrated: ${migrated}, skipped (already exists): ${skipped}, total agents scanned: ${allAgents.length}`,
  );

  return { migrated, skipped, total: allAgents.length };
}

// ---------------------------------------------------------------------------
// Helpers (same as heartbeat-config service)
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function toInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  return fallback;
}
