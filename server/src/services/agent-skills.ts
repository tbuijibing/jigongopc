import { and, eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, agentSkills, skillRegistry } from "@jigongai/db";
import { INSTALL_TYPES } from "@jigongai/shared";
import { notFound, unprocessable } from "../errors.js";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateInstallType(installType: string): void {
  if (!(INSTALL_TYPES as readonly string[]).includes(installType)) {
    throw unprocessable(
      `Invalid installType '${installType}'. Must be one of: ${INSTALL_TYPES.join(", ")}`,
    );
  }
}

export function agentSkillService(db: Db) {
  async function ensureAgentBelongsToCompany(
    companyId: string,
    agentId: string,
  ) {
    const agent = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!agent) {
      throw notFound("Agent not found in this company");
    }
    return agent;
  }

  async function ensureSkillBelongsToCompany(
    companyId: string,
    skillId: string,
  ) {
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
      throw notFound("Skill not found in this company");
    }
    return skill;
  }

  return {
    installSkill: async (
      companyId: string,
      agentId: string,
      skillId: string,
      installType: string,
      installedBy?: string | null,
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);
      await ensureSkillBelongsToCompany(companyId, skillId);
      validateInstallType(installType);

      return db
        .insert(agentSkills)
        .values({
          companyId,
          agentId,
          skillId,
          installType,
          installedBy: installedBy ?? null,
          enabled: true,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    uninstallSkill: async (
      companyId: string,
      agentId: string,
      skillId: string,
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);

      const deleted = await db
        .delete(agentSkills)
        .where(
          and(
            eq(agentSkills.companyId, companyId),
            eq(agentSkills.agentId, agentId),
            eq(agentSkills.skillId, skillId),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!deleted) {
        throw notFound("Skill not installed for this agent");
      }
      return deleted;
    },

    /**
     * Get agent skills with fallback chain (Requirement 4.7 / 17.5):
     *   1. skill_registry + agent_skills → return installed skills
     *   2. agents.adapterConfig.instructionsFilePath → return fallback reference
     */
    getAgentSkills: async (companyId: string, agentId: string) => {
      const agent = await ensureAgentBelongsToCompany(companyId, agentId);

      // Read installed skills from agent_skills joined with skill_registry
      const installed = await db
        .select({
          id: agentSkills.id,
          companyId: agentSkills.companyId,
          agentId: agentSkills.agentId,
          skillId: agentSkills.skillId,
          installType: agentSkills.installType,
          installedBy: agentSkills.installedBy,
          config: agentSkills.config,
          enabled: agentSkills.enabled,
          installedAt: agentSkills.installedAt,
          skillName: skillRegistry.name,
          skillSlug: skillRegistry.slug,
          skillDescription: skillRegistry.description,
          skillContent: skillRegistry.content,
          skillCategory: skillRegistry.category,
          skillVersion: skillRegistry.version,
        })
        .from(agentSkills)
        .innerJoin(skillRegistry, eq(agentSkills.skillId, skillRegistry.id))
        .where(
          and(
            eq(agentSkills.companyId, companyId),
            eq(agentSkills.agentId, agentId),
          ),
        );

      if (installed.length > 0) {
        return { source: "agent_skills" as const, skills: installed };
      }

      // Fallback to instructionsFilePath
      const config = agent.adapterConfig;
      const instructionsFilePath =
        isPlainRecord(config) && typeof config.instructionsFilePath === "string"
          ? config.instructionsFilePath
          : null;

      return {
        source: "fallback" as const,
        skills: [] as typeof installed,
        instructionsFilePath,
      };
    },
  };
}
