import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { agentSkillService } from "../services/agent-skills.js";
import type { Db } from "@jigongai/db";
import { INSTALL_TYPES } from "@jigongai/shared";

/**
 * Property 20: Skill install type correctness
 *
 * For any skill installation, the installType SHALL accurately reflect the
 * installation method: manual for board UI installs, self_install for Agent
 * API installs, auto_role for role-based automatic installs.
 *
 * **Validates: Requirements 4.3, 4.4, 4.5**
 */

/**
 * Property 1 (Skills dimension): Fallback chain round-trip
 *
 * When agent_skills has records, returns those; when no records exist,
 * falls back to instructionsFilePath from agents.adapterConfig.
 *
 * **Validates: Requirements 4.7**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface MockAgent {
  id: string;
  companyId: string;
  adapterConfig: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface MockSkillRegistryRow {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  content: string;
  category: string;
  version: string;
  author: string | null;
  isBuiltin: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAgentSkillRow {
  id: string;
  companyId: string;
  agentId: string;
  skillId: string;
  installType: string;
  installedBy: string | null;
  config: Record<string, unknown> | null;
  enabled: boolean;
  installedAt: Date;
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.uuid();
const agentIdArb = fc.uuid();
const skillIdArb = fc.uuid();
const userIdArb = fc.uuid();

const installTypeArb = fc.constantFrom(...INSTALL_TYPES);

const instructionsFilePathArb = fc.oneof(
  fc.constant("/workspace/skills/coding.md"),
  fc.constant("/home/agent/instructions.md"),
  fc.string({ minLength: 3, maxLength: 50 }),
);

// ── Mock DB builders ────────────────────────────────────────────────────────

/**
 * Build a mock Db for installSkill that handles:
 *   1. ensureAgentBelongsToCompany — select from agents
 *   2. ensureSkillBelongsToCompany — select from skillRegistry
 *   3. insert into agentSkills
 */
function buildInstallMockDb(opts: {
  agent: MockAgent;
  skill: MockSkillRegistryRow;
  onInsert: (row: MockAgentSkillRow) => void;
}): Db {
  const { agent, skill, onInsert } = opts;
  let selectCallCount = 0;

  return {
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: (rows: unknown[]) => unknown) => {
            selectCallCount++;
            // First select: ensureAgentBelongsToCompany
            if (selectCallCount === 1) {
              return resolve([agent]);
            }
            // Second select: ensureSkillBelongsToCompany
            return resolve([skill]);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: () => ({
          then: (resolve: (rows: unknown[]) => unknown) => {
            const row: MockAgentSkillRow = {
              id: "new-agent-skill-id",
              companyId: values.companyId as string,
              agentId: values.agentId as string,
              skillId: values.skillId as string,
              installType: values.installType as string,
              installedBy: (values.installedBy as string | null) ?? null,
              config: null,
              enabled: values.enabled as boolean,
              installedAt: new Date(),
            };
            onInsert(row);
            return resolve([row]);
          },
        }),
      }),
    }),
  } as unknown as Db;
}

/**
 * Build a mock Db for getAgentSkills that handles:
 *   1. ensureAgentBelongsToCompany — select from agents
 *   2. select from agentSkills joined with skillRegistry
 */
function buildGetSkillsMockDb(opts: {
  agent: MockAgent;
  installedSkills: Array<{
    agentSkill: MockAgentSkillRow;
    registrySkill: MockSkillRegistryRow;
  }>;
}): Db {
  const { agent, installedSkills } = opts;
  let selectCallCount = 0;

  return {
    select: (_fields?: Record<string, unknown>) => ({
      from: () => ({
        where: () => ({
          then: (resolve: (rows: unknown[]) => unknown) => {
            selectCallCount++;
            // First select: ensureAgentBelongsToCompany
            if (selectCallCount === 1) {
              return resolve([agent]);
            }
            // Should not reach here for getAgentSkills — the join path is used
            return resolve([]);
          },
        }),
        innerJoin: () => ({
          where: () => {
            // Return the joined result set
            const joinedRows = installedSkills.map((s) => ({
              id: s.agentSkill.id,
              companyId: s.agentSkill.companyId,
              agentId: s.agentSkill.agentId,
              skillId: s.agentSkill.skillId,
              installType: s.agentSkill.installType,
              installedBy: s.agentSkill.installedBy,
              config: s.agentSkill.config,
              enabled: s.agentSkill.enabled,
              installedAt: s.agentSkill.installedAt,
              skillName: s.registrySkill.name,
              skillSlug: s.registrySkill.slug,
              skillDescription: s.registrySkill.description,
              skillContent: s.registrySkill.content,
              skillCategory: s.registrySkill.category,
              skillVersion: s.registrySkill.version,
            }));
            return joinedRows;
          },
        }),
      }),
    }),
  } as unknown as Db;
}

// ── Property 20: Skill install type correctness ─────────────────────────────

describe("Property 20: Skill install type correctness", () => {
  it("installType in the written record matches the installType argument for any valid install type", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        skillIdArb,
        installTypeArb,
        fc.option(userIdArb, { nil: null }),
        async (companyId, agentId, skillId, installType, installedBy) => {
          let writtenRow: MockAgentSkillRow | null = null;

          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const skill: MockSkillRegistryRow = {
            id: skillId,
            companyId,
            name: "test-skill",
            slug: "test-skill",
            description: null,
            content: "# Skill",
            category: "development",
            version: "1.0.0",
            author: null,
            isBuiltin: false,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildInstallMockDb({
            agent,
            skill,
            onInsert: (row) => { writtenRow = row; },
          });

          const service = agentSkillService(db);
          await service.installSkill(companyId, agentId, skillId, installType, installedBy);

          expect(writtenRow).not.toBeNull();
          expect(writtenRow!.installType).toBe(installType);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("manual installs record installType as 'manual'", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        skillIdArb,
        userIdArb,
        async (companyId, agentId, skillId, userId) => {
          let writtenRow: MockAgentSkillRow | null = null;

          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const skill: MockSkillRegistryRow = {
            id: skillId,
            companyId,
            name: "skill",
            slug: "skill",
            description: null,
            content: "# Skill",
            category: "development",
            version: "1.0.0",
            author: null,
            isBuiltin: false,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildInstallMockDb({
            agent,
            skill,
            onInsert: (row) => { writtenRow = row; },
          });

          const service = agentSkillService(db);
          await service.installSkill(companyId, agentId, skillId, "manual", userId);

          expect(writtenRow).not.toBeNull();
          expect(writtenRow!.installType).toBe("manual");
          expect(writtenRow!.installedBy).toBe(userId);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("self_install records installType as 'self_install'", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        skillIdArb,
        async (companyId, agentId, skillId) => {
          let writtenRow: MockAgentSkillRow | null = null;

          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const skill: MockSkillRegistryRow = {
            id: skillId,
            companyId,
            name: "skill",
            slug: "skill",
            description: null,
            content: "# Skill",
            category: "development",
            version: "1.0.0",
            author: null,
            isBuiltin: false,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildInstallMockDb({
            agent,
            skill,
            onInsert: (row) => { writtenRow = row; },
          });

          const service = agentSkillService(db);
          // Agent self-installs — installedBy is the agentId itself
          await service.installSkill(companyId, agentId, skillId, "self_install", agentId);

          expect(writtenRow).not.toBeNull();
          expect(writtenRow!.installType).toBe("self_install");
        },
      ),
      { numRuns: 50 },
    );
  });

  it("auto_role installs record installType as 'auto_role'", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        skillIdArb,
        async (companyId, agentId, skillId) => {
          let writtenRow: MockAgentSkillRow | null = null;

          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const skill: MockSkillRegistryRow = {
            id: skillId,
            companyId,
            name: "skill",
            slug: "skill",
            description: null,
            content: "# Skill",
            category: "development",
            version: "1.0.0",
            author: null,
            isBuiltin: false,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildInstallMockDb({
            agent,
            skill,
            onInsert: (row) => { writtenRow = row; },
          });

          const service = agentSkillService(db);
          await service.installSkill(companyId, agentId, skillId, "auto_role", null);

          expect(writtenRow).not.toBeNull();
          expect(writtenRow!.installType).toBe("auto_role");
        },
      ),
      { numRuns: 50 },
    );
  });

  it("rejects invalid installType values", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        skillIdArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !(INSTALL_TYPES as readonly string[]).includes(s),
        ),
        async (companyId, agentId, skillId, invalidType) => {
          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const skill: MockSkillRegistryRow = {
            id: skillId,
            companyId,
            name: "skill",
            slug: "skill",
            description: null,
            content: "# Skill",
            category: "development",
            version: "1.0.0",
            author: null,
            isBuiltin: false,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildInstallMockDb({
            agent,
            skill,
            onInsert: () => {},
          });

          const service = agentSkillService(db);
          await expect(
            service.installSkill(companyId, agentId, skillId, invalidType),
          ).rejects.toThrow(/Invalid installType/);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── Property 1 (Skills dimension): Fallback chain round-trip ────────────────

describe("Property 1 (Skills): Fallback chain round-trip", () => {
  it("returns agent_skills data when installed skills exist", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        fc.array(
          fc.record({
            skillId: skillIdArb,
            installType: installTypeArb,
            skillName: fc.string({ minLength: 1, maxLength: 30 }),
            skillSlug: fc.string({ minLength: 1, maxLength: 30 }),
            skillContent: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        instructionsFilePathArb,
        async (companyId, agentId, skillDefs, legacyPath) => {
          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: { instructionsFilePath: legacyPath },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const installedSkills = skillDefs.map((def, i) => ({
            agentSkill: {
              id: `as-${i}`,
              companyId,
              agentId,
              skillId: def.skillId,
              installType: def.installType,
              installedBy: null,
              config: null,
              enabled: true,
              installedAt: new Date(),
            } satisfies MockAgentSkillRow,
            registrySkill: {
              id: def.skillId,
              companyId,
              name: def.skillName,
              slug: def.skillSlug,
              description: null,
              content: def.skillContent,
              category: "development",
              version: "1.0.0",
              author: null,
              isBuiltin: false,
              metadata: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            } satisfies MockSkillRegistryRow,
          }));

          const db = buildGetSkillsMockDb({ agent, installedSkills });
          const service = agentSkillService(db);
          const result = await service.getAgentSkills(companyId, agentId);

          expect(result.source).toBe("agent_skills");
          expect(result.skills.length).toBe(skillDefs.length);
          // Each returned skill should match the installed data
          for (let i = 0; i < skillDefs.length; i++) {
            expect(result.skills[i].skillName).toBe(skillDefs[i].skillName);
            expect(result.skills[i].installType).toBe(skillDefs[i].installType);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("falls back to instructionsFilePath when no installed skills exist", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        instructionsFilePathArb,
        async (companyId, agentId, legacyPath) => {
          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: { instructionsFilePath: legacyPath },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildGetSkillsMockDb({ agent, installedSkills: [] });
          const service = agentSkillService(db);
          const result = await service.getAgentSkills(companyId, agentId);

          expect(result.source).toBe("fallback");
          expect(result.skills).toEqual([]);
          expect(result.instructionsFilePath).toBe(legacyPath);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns null instructionsFilePath when no skills and no legacy config", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        fc.constantFrom({}, { instructionsFilePath: 42 }, { instructionsFilePath: null }, { other: "field" }),
        async (companyId, agentId, adapterConfig) => {
          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildGetSkillsMockDb({ agent, installedSkills: [] });
          const service = agentSkillService(db);
          const result = await service.getAgentSkills(companyId, agentId);

          expect(result.source).toBe("fallback");
          expect(result.skills).toEqual([]);
          expect(result.instructionsFilePath).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });
});
