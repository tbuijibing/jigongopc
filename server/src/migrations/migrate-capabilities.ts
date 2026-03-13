import { eq, isNotNull } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents } from "@jigongai/db";

/**
 * Migrate Capabilities data from agents.capabilities text → structured jsonb.
 *
 * - Reads all agents that have a non-null capabilities field
 * - If the value is already a structured object with the expected shape, skips
 * - If the value is a plain string (old text format), parses it into customTags
 * - If JSON.parse succeeds but shape is wrong, wraps into customTags
 * - Does NOT clear original data — updates in-place to structured jsonb
 * - Returns migration stats
 */
export async function migrateCapabilities(db: Db) {
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  const allAgents = await db
    .select({
      id: agents.id,
      capabilities: agents.capabilities,
    })
    .from(agents)
    .where(isNotNull(agents.capabilities));

  for (const agent of allAgents) {
    const raw = agent.capabilities;

    // Already null — shouldn't happen due to WHERE, but guard
    if (raw == null) continue;

    // Already structured with expected shape — skip
    if (
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      Array.isArray((raw as Record<string, unknown>).languages) &&
      Array.isArray((raw as Record<string, unknown>).frameworks) &&
      Array.isArray((raw as Record<string, unknown>).domains) &&
      Array.isArray((raw as Record<string, unknown>).tools) &&
      Array.isArray((raw as Record<string, unknown>).customTags)
    ) {
      skipped++;
      continue;
    }

    // Build structured capabilities from whatever we have
    try {
      const structured = parseToStructured(raw);
      await db
        .update(agents)
        .set({ capabilities: structured })
        .where(eq(agents.id, agent.id));
      migrated++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `[migrate-capabilities] Error migrating agent ${agent.id}: ${reason}`,
      );
      errors++;
    }
  }

  console.log(
    `[migrate-capabilities] done — migrated: ${migrated}, skipped (already structured): ${skipped}, errors: ${errors}, total agents scanned: ${allAgents.length}`,
  );

  return { migrated, skipped, errors, total: allAgents.length };
}

function emptyCapabilities() {
  return {
    languages: [] as string[],
    frameworks: [] as string[],
    domains: [] as string[],
    tools: [] as string[],
    customTags: [] as string[],
  };
}

/**
 * Parse a raw capabilities value into the structured format.
 * - If it's a string, split by commas and put into customTags
 * - If it's an object, merge known arrays and put unknowns into customTags
 */
function parseToStructured(raw: unknown): {
  languages: string[];
  frameworks: string[];
  domains: string[];
  tools: string[];
  customTags: string[];
} {
  // Handle string values (old text format)
  if (typeof raw === "string") {
    const tags = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return { ...emptyCapabilities(), customTags: tags.length > 0 ? tags : [raw].filter(Boolean) };
  }

  // Handle object values (partially structured or unexpected shape)
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const result = emptyCapabilities();
    for (const key of ["languages", "frameworks", "domains", "tools", "customTags"] as const) {
      if (Array.isArray(obj[key])) {
        result[key] = (obj[key] as unknown[]).map(String);
      }
    }
    return result;
  }

  // Anything else — stringify and put into customTags
  const fallback = String(raw);
  return { ...emptyCapabilities(), customTags: fallback ? [fallback] : [] };
}
