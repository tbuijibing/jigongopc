import { and, eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { skillRegistry } from "@jigongai/db";
import { SKILL_CATEGORIES } from "@jigongai/shared";
import { notFound, unprocessable } from "../errors.js";

function validateCategory(category: string): void {
  if (!(SKILL_CATEGORIES as readonly string[]).includes(category)) {
    throw unprocessable(
      `Invalid category '${category}'. Must be one of: ${SKILL_CATEGORIES.join(", ")}`,
    );
  }
}

export function skillRegistryService(db: Db) {
  return {
    listSkills: async (companyId: string) => {
      return db
        .select()
        .from(skillRegistry)
        .where(eq(skillRegistry.companyId, companyId));
    },

    createSkill: async (
      companyId: string,
      data: {
        name: string;
        slug: string;
        description?: string | null;
        content: string;
        category: string;
        version?: string;
        author?: string | null;
        isBuiltin?: boolean;
        metadata?: Record<string, unknown> | null;
      },
    ) => {
      validateCategory(data.category);

      return db
        .insert(skillRegistry)
        .values({
          companyId,
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          content: data.content,
          category: data.category,
          version: data.version ?? "1.0.0",
          author: data.author ?? null,
          isBuiltin: data.isBuiltin ?? false,
          metadata: data.metadata ?? null,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    getSkill: async (companyId: string, skillId: string) => {
      const skill = await db
        .select()
        .from(skillRegistry)
        .where(
          and(
            eq(skillRegistry.id, skillId),
            eq(skillRegistry.companyId, companyId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!skill) {
        throw notFound("Skill not found");
      }
      return skill;
    },

    updateSkill: async (
      companyId: string,
      skillId: string,
      data: {
        name?: string;
        slug?: string;
        description?: string | null;
        content?: string;
        category?: string;
        version?: string;
        author?: string | null;
        isBuiltin?: boolean;
        metadata?: Record<string, unknown> | null;
      },
    ) => {
      if (data.category !== undefined) {
        validateCategory(data.category);
      }

      const existing = await db
        .select()
        .from(skillRegistry)
        .where(
          and(
            eq(skillRegistry.id, skillId),
            eq(skillRegistry.companyId, companyId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!existing) {
        throw notFound("Skill not found");
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) patch.name = data.name;
      if (data.slug !== undefined) patch.slug = data.slug;
      if (data.description !== undefined) patch.description = data.description;
      if (data.content !== undefined) patch.content = data.content;
      if (data.category !== undefined) patch.category = data.category;
      if (data.version !== undefined) patch.version = data.version;
      if (data.author !== undefined) patch.author = data.author;
      if (data.isBuiltin !== undefined) patch.isBuiltin = data.isBuiltin;
      if (data.metadata !== undefined) patch.metadata = data.metadata;

      return db
        .update(skillRegistry)
        .set(patch)
        .where(eq(skillRegistry.id, skillId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    deleteSkill: async (companyId: string, skillId: string) => {
      const deleted = await db
        .delete(skillRegistry)
        .where(
          and(
            eq(skillRegistry.id, skillId),
            eq(skillRegistry.companyId, companyId),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!deleted) {
        throw notFound("Skill not found");
      }
      return deleted;
    },
  };
}
