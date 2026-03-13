import { and, eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, agentSouls } from "@jigongai/db";
import { notFound } from "../errors.js";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function soulService(db: Db) {
  /**
   * Verify the agent exists and belongs to the specified company.
   * Returns the agent row or throws 404.
   */
  async function ensureAgent(companyId: string, agentId: string) {
    const row = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Agent not found in this company");
    return row;
  }

  /**
   * Read Soul for an agent.
   * Fallback chain: agent_souls → agents.adapterConfig.promptTemplate
   */
  async function getSoul(companyId: string, agentId: string) {
    const agent = await ensureAgent(companyId, agentId);

    // Try dedicated table first
    const soul = await db
      .select()
      .from(agentSouls)
      .where(and(eq(agentSouls.companyId, companyId), eq(agentSouls.agentId, agentId)))
      .then((rows) => rows[0] ?? null);

    if (soul) return { source: "agent_souls" as const, data: soul };

    // Fallback to adapterConfig.promptTemplate
    const config = agent.adapterConfig;
    const promptTemplate =
      isPlainRecord(config) && typeof config.promptTemplate === "string"
        ? config.promptTemplate
        : null;

    return {
      source: "fallback" as const,
      data: {
        id: null,
        companyId,
        agentId,
        systemPrompt: promptTemplate ?? "",
        personality: null,
        constraints: null,
        outputFormat: null,
        language: "en",
        version: 0,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
    };
  }

  /**
   * Upsert Soul for an agent.
   * Auto-increments version on every write.
   */
  async function upsertSoul(
    companyId: string,
    agentId: string,
    data: {
      systemPrompt: string;
      personality?: string | null;
      constraints?: string | null;
      outputFormat?: string | null;
      language?: string;
    },
  ) {
    await ensureAgent(companyId, agentId);

    // Read current version (0 if no record exists)
    const existing = await db
      .select({ version: agentSouls.version })
      .from(agentSouls)
      .where(and(eq(agentSouls.companyId, companyId), eq(agentSouls.agentId, agentId)))
      .then((rows) => rows[0] ?? null);

    const nextVersion = (existing?.version ?? 0) + 1;
    const now = new Date();

    const row = await db
      .insert(agentSouls)
      .values({
        companyId,
        agentId,
        systemPrompt: data.systemPrompt,
        personality: data.personality ?? null,
        constraints: data.constraints ?? null,
        outputFormat: data.outputFormat ?? null,
        language: data.language ?? "en",
        version: nextVersion,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [agentSouls.companyId, agentSouls.agentId],
        set: {
          systemPrompt: data.systemPrompt,
          personality: data.personality ?? null,
          constraints: data.constraints ?? null,
          outputFormat: data.outputFormat ?? null,
          language: data.language ?? "en",
          version: nextVersion,
          updatedAt: now,
        },
      })
      .returning()
      .then((rows) => rows[0]);

    return row;
  }

  return {
    getSoul,
    upsertSoul,
  };
}
