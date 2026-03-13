import * as fs from "node:fs";
import * as path from "node:path";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, skillRegistry, agentSkills } from "@jigongai/db";

/**
 * Migrate Skills data from file-system skills (instructionsFilePath) → skill_registry + agent_skills tables.
 *
 * - Reads all agents that have a non-empty instructionsFilePath in adapterConfig
 * - Resolves the file path relative to adapterConfig.cwd
 * - Reads the file content and creates a skill_registry entry (isBuiltin = true)
 * - Creates an agent_skills entry linking the agent to the skill (installType = 'migration')
 * - Skips if skill_registry entry with same slug already exists for the company
 * - Skips if agent_skills entry already exists
 * - Does NOT delete original files (kept for fallback)
 * - Returns migration stats
 */
export async function migrateSkills(db: Db) {
  let migrated = 0;
  let skipped = 0;
  let fileErrors = 0;

  // Fetch all agents with a non-null adapterConfig
  const allAgents = await db
    .select({
      id: agents.id,
      companyId: agents.companyId,
      adapterConfig: agents.adapterConfig,
    })
    .from(agents)
    .where(isNotNull(agents.adapterConfig));

  for (const agent of allAgents) {
    const config = agent.adapterConfig;
    if (
      typeof config !== "object" ||
      config === null ||
      Array.isArray(config)
    ) {
      continue;
    }

    const rec = config as Record<string, unknown>;
    const instructionsFilePath =
      typeof rec.instructionsFilePath === "string"
        ? rec.instructionsFilePath.trim()
        : "";

    if (!instructionsFilePath) continue; // no instructions file to migrate

    // Resolve path relative to cwd
    const cwd = typeof rec.cwd === "string" ? rec.cwd : "";
    const resolvedPath = path.isAbsolute(instructionsFilePath)
      ? instructionsFilePath
      : cwd
        ? path.resolve(cwd, instructionsFilePath)
        : instructionsFilePath;

    // Derive slug from filename (e.g. "skills/coding-standards.md" → "coding-standards")
    const basename = path.basename(resolvedPath, path.extname(resolvedPath));
    const slug = basename
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug) continue;

    // Check if skill_registry entry with same slug already exists for this company
    const existingSkill = await db
      .select({ id: skillRegistry.id })
      .from(skillRegistry)
      .where(
        and(
          eq(skillRegistry.companyId, agent.companyId),
          eq(skillRegistry.slug, slug),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (existingSkill) {
      // Skill exists — just ensure agent_skills link exists
      const existingLink = await db
        .select({ id: agentSkills.id })
        .from(agentSkills)
        .where(
          and(
            eq(agentSkills.companyId, agent.companyId),
            eq(agentSkills.agentId, agent.id),
            eq(agentSkills.skillId, existingSkill.id),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!existingLink) {
        await db.insert(agentSkills).values({
          companyId: agent.companyId,
          agentId: agent.id,
          skillId: existingSkill.id,
          installType: "migration",
          installedBy: null,
          config: null,
          enabled: true,
          installedAt: new Date(),
        });
        migrated++;
      } else {
        skipped++;
      }
      continue;
    }

    // Read file content
    let content: string;
    try {
      content = fs.readFileSync(resolvedPath, "utf8");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `[migrate-skills] Could not read "${resolvedPath}" for agent ${agent.id}: ${reason}`,
      );
      fileErrors++;
      continue;
    }

    // Create skill_registry entry
    const now = new Date();
    const [inserted] = await db
      .insert(skillRegistry)
      .values({
        companyId: agent.companyId,
        name: basename,
        slug,
        description: `Migrated from ${instructionsFilePath}`,
        content,
        category: "custom",
        version: "1.0.0",
        author: null,
        isBuiltin: true,
        metadata: { migratedFrom: instructionsFilePath },
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: skillRegistry.id });

    // Create agent_skills link
    await db.insert(agentSkills).values({
      companyId: agent.companyId,
      agentId: agent.id,
      skillId: inserted.id,
      installType: "migration",
      installedBy: null,
      config: null,
      enabled: true,
      installedAt: now,
    });

    migrated++;
  }

  console.log(
    `[migrate-skills] done — migrated: ${migrated}, skipped (already exists): ${skipped}, file errors: ${fileErrors}, total agents scanned: ${allAgents.length}`,
  );

  return { migrated, skipped, fileErrors, total: allAgents.length };
}
