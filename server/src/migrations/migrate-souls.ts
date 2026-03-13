import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, agentSouls } from "@jigongai/db";

/**
 * Migrate Soul data from agents.adapterConfig.promptTemplate → agent_souls table.
 *
 * - Reads all agents
 * - For agents with promptTemplate in adapterConfig, uses that as systemPrompt
 * - For agents without promptTemplate, creates a default soul with empty systemPrompt
 * - Inserts into agent_souls with version=1 (skips agents that already have a record)
 * - Does NOT delete the original adapterConfig.promptTemplate (kept for fallback)
 * - Returns migration stats
 */
export async function migrateSouls(db: Db) {
  let migrated = 0;
  let skipped = 0;

  // Fetch ALL agents (not just those with adapterConfig)
  const allAgents = await db
    .select({
      id: agents.id,
      companyId: agents.companyId,
      adapterConfig: agents.adapterConfig,
      createdAt: agents.createdAt,
    })
    .from(agents);

  for (const agent of allAgents) {
    // Check if agent_souls record already exists
    const existing = await db
      .select({ id: agentSouls.id })
      .from(agentSouls)
      .where(
        and(eq(agentSouls.companyId, agent.companyId), eq(agentSouls.agentId, agent.id)),
      )
      .then((rows) => rows[0] ?? null);

    if (existing) {
      skipped++;
      continue;
    }

    // Extract promptTemplate if it exists
    let systemPrompt = "";
    const config = agent.adapterConfig;
    if (
      typeof config === "object" &&
      config !== null &&
      !Array.isArray(config) &&
      typeof (config as Record<string, unknown>).promptTemplate === "string"
    ) {
      systemPrompt = (config as Record<string, unknown>).promptTemplate as string;
    }

    // Create soul record (even if systemPrompt is empty)
    const now = new Date();
    await db.insert(agentSouls).values({
      companyId: agent.companyId,
      agentId: agent.id,
      systemPrompt,
      personality: null,
      constraints: null,
      outputFormat: null,
      language: "en",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    migrated++;
  }

  console.log(
    `[migrate-souls] done — migrated: ${migrated}, skipped (already exists): ${skipped}, total agents scanned: ${allAgents.length}`,
  );

  return { migrated, skipped, total: allAgents.length };
}
