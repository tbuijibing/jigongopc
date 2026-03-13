import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { soulService } from "../services/soul.js";
import type { Db } from "@jigongai/db";

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.uuid();
const agentIdArb = fc.uuid();

/** Generate a non-empty string for systemPrompt */
const systemPromptArb = fc.string({ minLength: 1, maxLength: 500 });

/** Generate optional soul fields */
const soulDataArb = fc.record({
  systemPrompt: systemPromptArb,
  personality: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  constraints: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  outputFormat: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  language: fc.constantFrom("en", "zh", "ja", "ko", "es", "fr"),
});

/** Generate a positive integer for existing version */
const versionArb = fc.integer({ min: 0, max: 10000 });

/** Generate a promptTemplate string for fallback testing */
const promptTemplateArb = fc.string({ minLength: 1, maxLength: 500 });

// ── Mock DB builders ────────────────────────────────────────────────────────

/**
 * Agent row shape returned by the agents table select.
 */
interface MockAgent {
  id: string;
  companyId: string;
  adapterConfig: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Soul row shape stored in agent_souls table.
 */
interface MockSoulRow {
  id: string;
  companyId: string;
  agentId: string;
  systemPrompt: string;
  personality: string | null;
  constraints: string | null;
  outputFormat: string | null;
  language: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Build a mock Db that simulates the Drizzle query chains used by SoulService.
 *
 * The SoulService uses:
 *   - db.select().from(agents).where(...).then(...)        — ensureAgent
 *   - db.select().from(agentSouls).where(...).then(...)    — getSoul read
 *   - db.select({ version }).from(agentSouls).where(...).then(...)  — upsertSoul version read
 *   - db.insert(agentSouls).values(...).onConflictDoUpdate(...).returning().then(...)  — upsertSoul write
 */
function buildMockDb(opts: {
  agent: MockAgent | null;
  soulRow: MockSoulRow | null;
  /** Callback invoked when upsert writes a soul row — captures the written data */
  onUpsert?: (row: MockSoulRow) => void;
}): Db {
  const { agent, soulRow, onUpsert } = opts;

  // Track the current soul state for sequential operations
  let currentSoul = soulRow ? { ...soulRow } : null;

  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => ({
          then: (resolve: (rows: unknown[]) => unknown) => {
            // Determine which table is being queried by checking the fields
            // If fields has 'version' key, it's the version-only select from agentSouls
            if (fields && "version" in fields) {
              // Version-only select from agentSouls
              return resolve(currentSoul ? [{ version: currentSoul.version }] : []);
            }
            // Full select — distinguish agents vs agentSouls by checking if agent or soul
            // The service queries agents first (ensureAgent), then agentSouls (getSoul)
            // We use a call counter to track which query we're on
            if (!selectCallTracker.agentQueried) {
              selectCallTracker.agentQueried = true;
              return resolve(agent ? [agent] : []);
            }
            // Second full select is agentSouls
            return resolve(currentSoul ? [currentSoul] : []);
          },
        }),
      }),
    }),
    insert: (_table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: (conflictOpts: { target: unknown; set: Record<string, unknown> }) => ({
          returning: () => ({
            then: (resolve: (rows: unknown[]) => unknown) => {
              const now = new Date();
              const newRow: MockSoulRow = {
                id: currentSoul?.id ?? "new-soul-id",
                companyId: (values.companyId as string) ?? "",
                agentId: (values.agentId as string) ?? "",
                systemPrompt: (conflictOpts.set.systemPrompt as string) ?? (values.systemPrompt as string) ?? "",
                personality: (conflictOpts.set.personality as string | null) ?? (values.personality as string | null) ?? null,
                constraints: (conflictOpts.set.constraints as string | null) ?? (values.constraints as string | null) ?? null,
                outputFormat: (conflictOpts.set.outputFormat as string | null) ?? (values.outputFormat as string | null) ?? null,
                language: (conflictOpts.set.language as string) ?? (values.language as string) ?? "en",
                version: (conflictOpts.set.version as number) ?? (values.version as number) ?? 1,
                createdAt: currentSoul?.createdAt ?? now,
                updatedAt: now,
              };
              currentSoul = newRow;
              onUpsert?.(newRow);
              return resolve([newRow]);
            },
          }),
        }),
      }),
    }),
  } as unknown as Db;

  // Track select calls to distinguish agents vs agentSouls queries
  const selectCallTracker = { agentQueried: false };

  // Attach tracker reset for each top-level operation
  const originalSelect = db.select.bind(db);
  db.select = ((fields?: Record<string, unknown>) => {
    // Reset tracker at the start of each service method call
    // (getSoul calls ensureAgent then queries agentSouls)
    return originalSelect(fields);
  }) as typeof db.select;

  return db;
}

/**
 * Build a mock Db specifically for upsertSoul that handles the
 * ensureAgent + version-read + insert sequence correctly.
 */
function buildUpsertMockDb(opts: {
  agent: MockAgent;
  existingVersion: number | null;
  onUpsert: (row: MockSoulRow) => void;
}): Db {
  const { agent, existingVersion, onUpsert } = opts;
  let selectCallCount = 0;

  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (_table: unknown) => ({
        where: (..._args: unknown[]) => ({
          then: (resolve: (rows: unknown[]) => unknown) => {
            selectCallCount++;
            // First select: ensureAgent
            if (selectCallCount === 1) {
              return resolve([agent]);
            }
            // Second select: version read from agentSouls
            if (existingVersion !== null) {
              return resolve([{ version: existingVersion }]);
            }
            return resolve([]);
          },
        }),
      }),
    }),
    insert: (_table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: (conflictOpts: { target: unknown; set: Record<string, unknown> }) => ({
          returning: () => ({
            then: (resolve: (rows: unknown[]) => unknown) => {
              const now = new Date();
              const newRow: MockSoulRow = {
                id: "soul-id",
                companyId: values.companyId as string,
                agentId: values.agentId as string,
                systemPrompt: values.systemPrompt as string,
                personality: (values.personality as string | null) ?? null,
                constraints: (values.constraints as string | null) ?? null,
                outputFormat: (values.outputFormat as string | null) ?? null,
                language: (values.language as string) ?? "en",
                version: values.version as number,
                createdAt: now,
                updatedAt: now,
              };
              onUpsert(newRow);
              return resolve([newRow]);
            },
          }),
        }),
      }),
    }),
  } as unknown as Db;

  return db;
}

// ── Property 19: Soul version auto-increment ────────────────────────────────

/**
 * Property 19: Soul version auto-increment
 *
 * For any Soul update operation, the resulting version number SHALL be
 * exactly one greater than the previous version number.
 *
 * **Validates: Requirements 2.3**
 */
describe("Property 19: Soul version auto-increment", () => {
  it("every upsert increments version by exactly 1 from the existing version", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        versionArb,
        soulDataArb,
        async (companyId, agentId, existingVersion, soulData) => {
          let writtenRow: MockSoulRow | null = null;

          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildUpsertMockDb({
            agent,
            existingVersion,
            onUpsert: (row) => { writtenRow = row; },
          });

          const service = soulService(db);
          await service.upsertSoul(companyId, agentId, soulData);

          expect(writtenRow).not.toBeNull();
          expect(writtenRow!.version).toBe(existingVersion + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("first upsert (no existing record) sets version to 1", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        soulDataArb,
        async (companyId, agentId, soulData) => {
          let writtenRow: MockSoulRow | null = null;

          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const db = buildUpsertMockDb({
            agent,
            existingVersion: null,
            onUpsert: (row) => { writtenRow = row; },
          });

          const service = soulService(db);
          await service.upsertSoul(companyId, agentId, soulData);

          expect(writtenRow).not.toBeNull();
          expect(writtenRow!.version).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 1 (Soul dimension): Fallback chain round-trip ──────────────────

/**
 * Property 1: Fallback chain round-trip (Soul dimension)
 *
 * If the agent_souls table has no record for an Agent, the service SHALL
 * return equivalent data from the legacy field (adapterConfig.promptTemplate).
 * If the agent_souls table does have a record, the service SHALL return
 * data from the new table and ignore the legacy field.
 *
 * **Validates: Requirements 2.2**
 */

/**
 * Build a mock Db for getSoul that handles the ensureAgent + agentSouls
 * select sequence.
 */
function buildGetSoulMockDb(opts: {
  agent: MockAgent;
  soulRow: MockSoulRow | null;
}): Db {
  const { agent, soulRow } = opts;
  let selectCallCount = 0;

  const db = {
    select: () => ({
      from: (_table: unknown) => ({
        where: (..._args: unknown[]) => ({
          then: (resolve: (rows: unknown[]) => unknown) => {
            selectCallCount++;
            // First select: ensureAgent (agents table)
            if (selectCallCount === 1) {
              return resolve([agent]);
            }
            // Second select: agentSouls table
            return resolve(soulRow ? [soulRow] : []);
          },
        }),
      }),
    }),
  } as unknown as Db;

  return db;
}

describe("Property 1 (Soul): Fallback chain round-trip", () => {
  it("returns adapterConfig.promptTemplate when no soul record exists", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        promptTemplateArb,
        async (companyId, agentId, promptTemplate) => {
          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: { promptTemplate },
            createdAt: new Date("2025-01-01"),
            updatedAt: new Date("2025-01-01"),
          };

          const db = buildGetSoulMockDb({ agent, soulRow: null });
          const service = soulService(db);
          const result = await service.getSoul(companyId, agentId);

          // Should use fallback source
          expect(result.source).toBe("fallback");
          // systemPrompt should equal the legacy promptTemplate
          expect(result.data.systemPrompt).toBe(promptTemplate);
          // Fallback version is always 0
          expect(result.data.version).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns agent_souls data when a soul record exists, ignoring legacy field", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        soulDataArb,
        promptTemplateArb,
        versionArb.filter((v) => v >= 1),
        async (companyId, agentId, soulData, legacyPrompt, version) => {
          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: { promptTemplate: legacyPrompt },
            createdAt: new Date("2025-01-01"),
            updatedAt: new Date("2025-01-01"),
          };

          const soulRow: MockSoulRow = {
            id: "soul-id",
            companyId,
            agentId,
            systemPrompt: soulData.systemPrompt,
            personality: soulData.personality,
            constraints: soulData.constraints,
            outputFormat: soulData.outputFormat,
            language: soulData.language,
            version,
            createdAt: new Date("2025-01-02"),
            updatedAt: new Date("2025-01-02"),
          };

          const db = buildGetSoulMockDb({ agent, soulRow });
          const service = soulService(db);
          const result = await service.getSoul(companyId, agentId);

          // Should use agent_souls source
          expect(result.source).toBe("agent_souls");
          // Data should come from the soul row, not the legacy field
          expect(result.data.systemPrompt).toBe(soulData.systemPrompt);
          expect(result.data.personality).toBe(soulData.personality);
          expect(result.data.constraints).toBe(soulData.constraints);
          expect(result.data.outputFormat).toBe(soulData.outputFormat);
          expect(result.data.language).toBe(soulData.language);
          expect(result.data.version).toBe(version);
          // Legacy promptTemplate should be ignored
          expect(result.data.systemPrompt).not.toBe(legacyPrompt);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns empty systemPrompt when no soul record and no promptTemplate", async () => {
    await fc.assert(
      fc.asyncProperty(
        companyIdArb,
        agentIdArb,
        async (companyId, agentId) => {
          const agent: MockAgent = {
            id: agentId,
            companyId,
            adapterConfig: {},
            createdAt: new Date("2025-01-01"),
            updatedAt: new Date("2025-01-01"),
          };

          const db = buildGetSoulMockDb({ agent, soulRow: null });
          const service = soulService(db);
          const result = await service.getSoul(companyId, agentId);

          expect(result.source).toBe("fallback");
          expect(result.data.systemPrompt).toBe("");
        },
      ),
      { numRuns: 50 },
    );
  });
});
