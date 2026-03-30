import type { Db } from "@jigongai/db";
import { eq, and, desc } from "drizzle-orm";
import { companySkills } from "@jigongai/db/schema";
import type { CompanySkill, CompanySkillUpdateStatus } from "@jigongai/shared";

export function companySkillService(db: Db) {
  async function list(companyId: string): Promise<CompanySkill[]> {
    const rows = await db
      .select()
      .from(companySkills)
      .where(eq(companySkills.companyId, companyId))
      .orderBy(desc(companySkills.createdAt));
    return rows.map(rowToSkill);
  }

  async function detail(companyId: string, skillId: string): Promise<CompanySkill | null> {
    const rows = await db
      .select()
      .from(companySkills)
      .where(and(eq(companySkills.id, skillId), eq(companySkills.companyId, companyId)));
    const row = rows[0] ?? null;
    return row ? rowToSkill(row) : null;
  }

  async function create(
    companyId: string,
    input: {
      key: string;
      slug: string;
      name: string;
      description: string | null;
      markdown: string;
      sourceType: string;
      sourceLocator: string | null;
      sourceRef: string | null;
      trustLevel: string;
      metadata: Record<string, unknown> | null;
    },
  ): Promise<CompanySkill> {
    const rows = await db
      .insert(companySkills)
      .values({
        companyId,
        ...input,
        fileInventory: [],
        compatibility: "compatible",
      })
      .returning();
    return rowToSkill(rows[0]);
  }

  async function update(
    companyId: string,
    skillId: string,
    input: {
      name?: string;
      description?: string | null;
      markdown?: string;
      trustLevel?: string;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<CompanySkill | null> {
    const rows = await db
      .update(companySkills)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(companySkills.id, skillId), eq(companySkills.companyId, companyId)))
      .returning();
    const row = rows[0] ?? null;
    return row ? rowToSkill(row) : null;
  }

  async function remove(companyId: string, skillId: string): Promise<{ ok: true }> {
    await db
      .delete(companySkills)
      .where(and(eq(companySkills.id, skillId), eq(companySkills.companyId, companyId)));
    return { ok: true };
  }

  async function updateStatus(
    companyId: string,
    skillId: string,
  ): Promise<CompanySkillUpdateStatus | null> {
    const skill = await detail(companyId, skillId);
    if (!skill) return null;

    // For GitHub skills, check for updates
    if (skill.sourceType === "github" && skill.sourceLocator) {
      // Placeholder: In production, this would call GitHub API
      return {
        hasUpdate: false,
        currentVersion: skill.sourceRef ?? "main",
        latestVersion: skill.sourceRef ?? "main",
      };
    }

    return {
      hasUpdate: false,
      currentVersion: null,
      latestVersion: null,
    };
  }

  async function readFile(
    companyId: string,
    skillId: string,
    relativePath: string,
  ): Promise<{ path: string; content: string; type: string } | null> {
    const skill = await detail(companyId, skillId);
    if (!skill) return null;

    // For local skills, read from file system
    if (skill.sourceType === "local_path") {
      // Placeholder: In production, this would read from the skill directory
      return {
        path: relativePath,
        content: skill.markdown,
        type: relativePath.endsWith(".md") ? "markdown" : "code",
      };
    }

    return null;
  }

  return {
    list,
    detail,
    create,
    update,
    remove,
    updateStatus,
    readFile,
  };
}

function rowToSkill(row: typeof companySkills.$inferSelect): CompanySkill {
  return {
    id: row.id,
    companyId: row.companyId,
    key: row.key,
    slug: row.slug,
    name: row.name,
    description: row.description,
    markdown: row.markdown,
    sourceType: row.sourceType as CompanySkill["sourceType"],
    sourceLocator: row.sourceLocator,
    sourceRef: row.sourceRef,
    trustLevel: row.trustLevel as CompanySkill["trustLevel"],
    compatibility: row.compatibility as CompanySkill["compatibility"],
    fileInventory: row.fileInventory as CompanySkill["fileInventory"],
    metadata: row.metadata as CompanySkill["metadata"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
