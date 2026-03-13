import { and, eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, agentHeartbeatConfigs } from "@jigongai/db";
import { notFound } from "../errors.js";

/**
 * Fields we extract from agents.runtimeConfig.heartbeat as fallback
 * when no dedicated agent_heartbeat_configs row exists.
 */
interface HeartbeatConfigData {
  enabled: boolean;
  intervalSec: number;
  wakeOnAssignment: boolean;
  wakeOnMention: boolean;
  wakeOnDemand: boolean;
  maxConcurrentRuns: number;
  timeoutSec: number;
  cooldownSec: number;
}

/** Schema-level defaults matching agent_heartbeat_configs column defaults. */
const DEFAULTS: HeartbeatConfigData = {
  enabled: true,
  intervalSec: 300,
  wakeOnAssignment: true,
  wakeOnMention: true,
  wakeOnDemand: true,
  maxConcurrentRuns: 1,
  timeoutSec: 600,
  cooldownSec: 60,
};

// ---------------------------------------------------------------------------
// Tiny helpers for safe JSON field extraction (mirrors adapter-utils pattern)
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

// ---------------------------------------------------------------------------
// Extract heartbeat fields from the legacy runtimeConfig JSON blob.
// The existing heartbeat service reads runtimeConfig.heartbeat.{field}.
// ---------------------------------------------------------------------------

function extractFromRuntimeConfig(runtimeConfig: Record<string, unknown>): HeartbeatConfigData {
  const heartbeat = isPlainObject(runtimeConfig.heartbeat) ? runtimeConfig.heartbeat : {};
  return {
    enabled: toBool(heartbeat.enabled, DEFAULTS.enabled),
    intervalSec: toInt(heartbeat.intervalSec, DEFAULTS.intervalSec),
    wakeOnAssignment: toBool(heartbeat.wakeOnAssignment, DEFAULTS.wakeOnAssignment),
    wakeOnMention: toBool(heartbeat.wakeOnMention, DEFAULTS.wakeOnMention),
    wakeOnDemand: toBool(
      heartbeat.wakeOnDemand ?? heartbeat.wakeOnAssignment ?? heartbeat.wakeOnOnDemand ?? heartbeat.wakeOnAutomation,
      DEFAULTS.wakeOnDemand,
    ),
    maxConcurrentRuns: toInt(heartbeat.maxConcurrentRuns, DEFAULTS.maxConcurrentRuns),
    timeoutSec: toInt(heartbeat.timeoutSec, DEFAULTS.timeoutSec),
    cooldownSec: toInt(heartbeat.cooldownSec, DEFAULTS.cooldownSec),
  };
}

export function heartbeatConfigService(db: Db) {
  /**
   * Verify the agent exists and belongs to the specified company.
   * Returns the agent row or throws 404.
   */
  async function assertAgentBelongsToCompany(companyId: string, agentId: string) {
    const agent = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!agent) throw notFound("Agent not found");
    return agent;
  }

  /**
   * Read heartbeat config for an agent.
   *
   * Fallback chain (Requirement 1.2 / 17.5):
   *   1. agent_heartbeat_configs row  →  return it
   *   2. agents.runtimeConfig.heartbeat  →  extract & return
   */
  async function getConfig(companyId: string, agentId: string) {
    const agent = await assertAgentBelongsToCompany(companyId, agentId);

    // Try dedicated table first
    const row = await db
      .select()
      .from(agentHeartbeatConfigs)
      .where(
        and(
          eq(agentHeartbeatConfigs.companyId, companyId),
          eq(agentHeartbeatConfigs.agentId, agentId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (row) {
      return {
        source: "dedicated" as const,
        config: {
          id: row.id,
          companyId: row.companyId,
          agentId: row.agentId,
          enabled: row.enabled,
          intervalSec: row.intervalSec,
          wakeOnAssignment: row.wakeOnAssignment,
          wakeOnMention: row.wakeOnMention,
          wakeOnDemand: row.wakeOnDemand,
          maxConcurrentRuns: row.maxConcurrentRuns,
          timeoutSec: row.timeoutSec,
          cooldownSec: row.cooldownSec,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      };
    }

    // Fallback to runtimeConfig
    const runtimeConfig = isPlainObject(agent.runtimeConfig) ? agent.runtimeConfig : {};
    const fallback = extractFromRuntimeConfig(runtimeConfig);

    return {
      source: "fallback" as const,
      config: {
        id: null as string | null,
        companyId,
        agentId,
        ...fallback,
        createdAt: null as Date | null,
        updatedAt: null as Date | null,
      },
    };
  }

  /**
   * Create or update heartbeat config for an agent.
   * Validates field types/ranges and upserts into agent_heartbeat_configs.
   */
  async function upsertConfig(companyId: string, agentId: string, data: Partial<HeartbeatConfigData>) {
    await assertAgentBelongsToCompany(companyId, agentId);

    const now = new Date();

    const values: Record<string, unknown> = { updatedAt: now };
    if (data.enabled !== undefined) values.enabled = data.enabled;
    if (data.intervalSec !== undefined) values.intervalSec = Math.max(0, Math.floor(data.intervalSec));
    if (data.wakeOnAssignment !== undefined) values.wakeOnAssignment = data.wakeOnAssignment;
    if (data.wakeOnMention !== undefined) values.wakeOnMention = data.wakeOnMention;
    if (data.wakeOnDemand !== undefined) values.wakeOnDemand = data.wakeOnDemand;
    if (data.maxConcurrentRuns !== undefined) values.maxConcurrentRuns = Math.max(1, Math.floor(data.maxConcurrentRuns));
    if (data.timeoutSec !== undefined) values.timeoutSec = Math.max(0, Math.floor(data.timeoutSec));
    if (data.cooldownSec !== undefined) values.cooldownSec = Math.max(0, Math.floor(data.cooldownSec));

    const row = await db
      .insert(agentHeartbeatConfigs)
      .values({
        companyId,
        agentId,
        ...values,
      })
      .onConflictDoUpdate({
        target: [agentHeartbeatConfigs.companyId, agentHeartbeatConfigs.agentId],
        set: values,
      })
      .returning()
      .then((rows) => rows[0]);

    return row;
  }

  return {
    getConfig,
    upsertConfig,
  };
}
