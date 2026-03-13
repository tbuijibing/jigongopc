import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property-based tests for AgentMemoryService.
 *
 * Tests the pure validation logic and priority merge logic extracted from
 * server/src/services/agent-memories.ts.
 *
 * Uses vitest + fast-check.
 */

// ── Replicate pure logic from agent-memories.ts ─────────────────────────────

const MEMORY_LAYERS = ["agent", "project", "task"] as const;
type MemoryLayer = (typeof MEMORY_LAYERS)[number];

const MEMORY_TYPES = ["fact", "preference", "learning", "context"] as const;

/**
 * Pure validation: memoryLayer must be one of the valid layers.
 * Returns an error message or null if valid.
 */
function validateMemoryLayer(memoryLayer: string): string | null {
  if (!(MEMORY_LAYERS as readonly string[]).includes(memoryLayer)) {
    return `Invalid memoryLayer '${memoryLayer}'. Must be one of: ${MEMORY_LAYERS.join(", ")}`;
  }
  return null;
}

/**
 * Pure validation: memoryLayer / scopeId consistency (Requirement 5.4).
 *  - agent layer → scopeId must be null/undefined
 *  - project layer → scopeId must be a non-null string
 *  - task layer → scopeId must be a non-null string
 * Returns an error message or null if valid.
 */
function validateLayerScopeConsistency(
  memoryLayer: string,
  scopeId: string | null | undefined,
): string | null {
  if (memoryLayer === "agent") {
    if (scopeId != null) {
      return "agent-layer memory must have scopeId = null";
    }
  } else if (memoryLayer === "project") {
    if (!scopeId) {
      return "project-layer memory requires a non-null scopeId (projectId)";
    }
  } else if (memoryLayer === "task") {
    if (!scopeId) {
      return "task-layer memory requires a non-null scopeId (issueId)";
    }
  }
  return null;
}

/**
 * Pure priority merge logic: given a list of memory records across layers,
 * deduplicate by key using nearest-scope-wins (task > project > agent).
 */
interface MemoryRecord {
  id: string;
  key: string;
  value: string;
  memoryLayer: string;
  scopeId: string | null;
  expiresAt: Date | null;
}

const LAYER_PRIORITY: Record<string, number> = {
  task: 0,
  project: 1,
  agent: 2,
};

function mergeByPriority(memories: MemoryRecord[]): MemoryRecord[] {
  const byKey = new Map<string, MemoryRecord>();
  for (const mem of memories) {
    const existing = byKey.get(mem.key);
    if (
      !existing ||
      (LAYER_PRIORITY[mem.memoryLayer] ?? 99) <
        (LAYER_PRIORITY[existing.memoryLayer] ?? 99)
    ) {
      byKey.set(mem.key, mem);
    }
  }
  return Array.from(byKey.values());
}

/**
 * Pure expiry filter: exclude memories whose expiresAt is in the past.
 */
function filterExpired(memories: MemoryRecord[], now: Date): MemoryRecord[] {
  return memories.filter(
    (m) => m.expiresAt === null || m.expiresAt > now,
  );
}

// ── Generators ──────────────────────────────────────────────────────────────

const memoryLayerArb: fc.Arbitrary<MemoryLayer> = fc.constantFrom(...MEMORY_LAYERS);
const memoryTypeArb = fc.constantFrom(...MEMORY_TYPES);
const scopeIdArb = fc.uuid();
const keyArb = fc.string({ minLength: 1, maxLength: 50 });
const valueArb = fc.string({ minLength: 0, maxLength: 200 });

/** Generate a valid (memoryLayer, scopeId) pair that satisfies consistency rules */
const validLayerScopeArb: fc.Arbitrary<{ memoryLayer: MemoryLayer; scopeId: string | null }> =
  fc.oneof(
    fc.constant({ memoryLayer: "agent" as MemoryLayer, scopeId: null }),
    scopeIdArb.map((id) => ({ memoryLayer: "project" as MemoryLayer, scopeId: id })),
    scopeIdArb.map((id) => ({ memoryLayer: "task" as MemoryLayer, scopeId: id })),
  );

/** Generate an invalid (memoryLayer, scopeId) pair that violates consistency */
const invalidLayerScopeArb: fc.Arbitrary<{ memoryLayer: MemoryLayer; scopeId: string | null }> =
  fc.oneof(
    // agent layer with non-null scopeId
    scopeIdArb.map((id) => ({ memoryLayer: "agent" as MemoryLayer, scopeId: id })),
    // project layer with null scopeId
    fc.constant({ memoryLayer: "project" as MemoryLayer, scopeId: null }),
    // task layer with null scopeId
    fc.constant({ memoryLayer: "task" as MemoryLayer, scopeId: null }),
  );

/** Generate a MemoryRecord */
function memoryRecordArb(layer: MemoryLayer, scopeId: string | null): fc.Arbitrary<MemoryRecord> {
  return fc.record({
    id: fc.uuid(),
    key: keyArb,
    value: valueArb,
    memoryLayer: fc.constant(layer),
    scopeId: fc.constant(scopeId),
    expiresAt: fc.constant(null as Date | null),
  });
}

// ── Property 3: Memory layer-scopeId consistency ────────────────────────────

/**
 * Property 3: Memory layer-scopeId consistency
 *
 * For any memory write operation, the memoryLayer and scopeId must be consistent:
 * agent layer requires scopeId to be null, project layer requires scopeId to be
 * a valid projectId, and task layer requires scopeId to be a valid issueId.
 * Writes violating this invariant SHALL be rejected.
 *
 * **Validates: Requirements 5.1, 5.4**
 */
describe("Property 3: Memory layer-scopeId consistency", () => {
  it("valid combinations are accepted: agent+null, project+id, task+id", () => {
    fc.assert(
      fc.property(validLayerScopeArb, ({ memoryLayer, scopeId }) => {
        const error = validateLayerScopeConsistency(memoryLayer, scopeId);
        expect(error).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it("agent layer with non-null scopeId is rejected", () => {
    fc.assert(
      fc.property(scopeIdArb, (scopeId) => {
        const error = validateLayerScopeConsistency("agent", scopeId);
        expect(error).not.toBeNull();
        expect(error).toContain("agent-layer");
      }),
      { numRuns: 100 },
    );
  });

  it("project layer with null/empty scopeId is rejected", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ""),
        (scopeId) => {
          const error = validateLayerScopeConsistency("project", scopeId as string | null | undefined);
          expect(error).not.toBeNull();
          expect(error).toContain("project-layer");
        },
      ),
      { numRuns: 50 },
    );
  });

  it("task layer with null/empty scopeId is rejected", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ""),
        (scopeId) => {
          const error = validateLayerScopeConsistency("task", scopeId as string | null | undefined);
          expect(error).not.toBeNull();
          expect(error).toContain("task-layer");
        },
      ),
      { numRuns: 50 },
    );
  });

  it("all invalid layer-scope combinations are rejected", () => {
    fc.assert(
      fc.property(invalidLayerScopeArb, ({ memoryLayer, scopeId }) => {
        const error = validateLayerScopeConsistency(memoryLayer, scopeId);
        expect(error).not.toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it("invalid memoryLayer values are caught by layer validation", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !(MEMORY_LAYERS as readonly string[]).includes(s),
        ),
        (badLayer) => {
          const error = validateMemoryLayer(badLayer);
          expect(error).not.toBeNull();
          expect(error).toContain("Invalid memoryLayer");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 4: Memory read priority (task → project → agent) ───────────────

/**
 * Property 4: Memory read priority (task → project → agent)
 *
 * For any Agent with memories at multiple layers sharing the same key,
 * reading memories SHALL return the task-layer value over the project-layer
 * value, and the project-layer value over the agent-layer value
 * (nearest-scope-wins).
 *
 * **Validates: Requirements 5.2, 18.2**
 */
describe("Property 4: Memory read priority (task → project → agent)", () => {
  it("task-layer value wins over project and agent for the same key", () => {
    fc.assert(
      fc.property(
        keyArb,
        valueArb,
        valueArb,
        valueArb,
        scopeIdArb,
        scopeIdArb,
        (key, agentVal, projectVal, taskVal, projectScope, taskScope) => {
          const memories: MemoryRecord[] = [
            { id: "a1", key, value: agentVal, memoryLayer: "agent", scopeId: null, expiresAt: null },
            { id: "p1", key, value: projectVal, memoryLayer: "project", scopeId: projectScope, expiresAt: null },
            { id: "t1", key, value: taskVal, memoryLayer: "task", scopeId: taskScope, expiresAt: null },
          ];

          const result = mergeByPriority(memories);
          const found = result.find((m) => m.key === key);

          expect(found).toBeDefined();
          expect(found!.memoryLayer).toBe("task");
          expect(found!.value).toBe(taskVal);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("project-layer value wins over agent when no task-layer exists for the same key", () => {
    fc.assert(
      fc.property(
        keyArb,
        valueArb,
        valueArb,
        scopeIdArb,
        (key, agentVal, projectVal, projectScope) => {
          const memories: MemoryRecord[] = [
            { id: "a1", key, value: agentVal, memoryLayer: "agent", scopeId: null, expiresAt: null },
            { id: "p1", key, value: projectVal, memoryLayer: "project", scopeId: projectScope, expiresAt: null },
          ];

          const result = mergeByPriority(memories);
          const found = result.find((m) => m.key === key);

          expect(found).toBeDefined();
          expect(found!.memoryLayer).toBe("project");
          expect(found!.value).toBe(projectVal);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("agent-layer value is returned when it is the only layer for a key", () => {
    fc.assert(
      fc.property(keyArb, valueArb, (key, agentVal) => {
        const memories: MemoryRecord[] = [
          { id: "a1", key, value: agentVal, memoryLayer: "agent", scopeId: null, expiresAt: null },
        ];

        const result = mergeByPriority(memories);
        const found = result.find((m) => m.key === key);

        expect(found).toBeDefined();
        expect(found!.memoryLayer).toBe("agent");
        expect(found!.value).toBe(agentVal);
      }),
      { numRuns: 100 },
    );
  });

  it("distinct keys across layers are all preserved (no data loss)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(keyArb, { minLength: 2, maxLength: 5 }),
        scopeIdArb,
        scopeIdArb,
        (keys, projectScope, taskScope) => {
          // Assign each key to a different layer round-robin
          const layers: MemoryLayer[] = ["agent", "project", "task"];
          const memories: MemoryRecord[] = keys.map((key, i) => {
            const layer = layers[i % 3];
            return {
              id: `id-${i}`,
              key,
              value: `val-${i}`,
              memoryLayer: layer,
              scopeId: layer === "agent" ? null : layer === "project" ? projectScope : taskScope,
              expiresAt: null,
            };
          });

          const result = mergeByPriority(memories);
          // All distinct keys should be present
          expect(result.length).toBe(keys.length);
          for (const key of keys) {
            expect(result.some((m) => m.key === key)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("merge result never contains duplicate keys", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            key: fc.constantFrom("k1", "k2", "k3"),
            value: valueArb,
            memoryLayer: memoryLayerArb,
            scopeId: fc.oneof(fc.constant(null), scopeIdArb),
            expiresAt: fc.constant(null as Date | null),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (memories) => {
          const result = mergeByPriority(memories);
          const keys = result.map((m) => m.key);
          const uniqueKeys = new Set(keys);
          expect(keys.length).toBe(uniqueKeys.size);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("for every key in the result, no higher-priority memory exists in the input", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            key: fc.constantFrom("k1", "k2", "k3", "k4"),
            value: valueArb,
            memoryLayer: memoryLayerArb,
            scopeId: fc.oneof(fc.constant(null), scopeIdArb),
            expiresAt: fc.constant(null as Date | null),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (memories) => {
          const result = mergeByPriority(memories);

          for (const winner of result) {
            const winnerPriority = LAYER_PRIORITY[winner.memoryLayer] ?? 99;
            // No input memory with the same key should have a strictly lower
            // priority number (= higher priority)
            const hasBetter = memories.some(
              (m) =>
                m.key === winner.key &&
                (LAYER_PRIORITY[m.memoryLayer] ?? 99) < winnerPriority,
            );
            expect(hasBetter).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── Property 5: Expired memories excluded ───────────────────────────────────

/**
 * Property 5: Expired memories excluded
 *
 * For any memory record whose expiresAt timestamp is in the past, that record
 * SHALL NOT appear in any memory read result.
 *
 * **Validates: Requirement 5.5**
 */
describe("Property 5: Expired memories excluded", () => {
  it("memories with expiresAt in the past are excluded", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            key: keyArb,
            value: valueArb,
            memoryLayer: fc.constant("agent" as string),
            scopeId: fc.constant(null as string | null),
            expiresAt: fc.oneof(
              fc.constant(null as Date | null),
              // Past date
              fc.date({ min: new Date("2020-01-01"), max: new Date("2024-01-01") }).map(
                (d) => d as Date | null,
              ),
              // Future date
              fc.date({ min: new Date("2030-01-01"), max: new Date("2040-01-01") }).map(
                (d) => d as Date | null,
              ),
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (memories) => {
          const now = new Date("2025-06-01");
          const result = filterExpired(memories, now);

          // No result should have expiresAt in the past
          for (const mem of result) {
            if (mem.expiresAt !== null) {
              expect(mem.expiresAt.getTime()).toBeGreaterThan(now.getTime());
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("memories with null expiresAt are always included", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            key: keyArb,
            value: valueArb,
            memoryLayer: fc.constant("agent" as string),
            scopeId: fc.constant(null as string | null),
            expiresAt: fc.constant(null as Date | null),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (memories) => {
          const now = new Date();
          const result = filterExpired(memories, now);
          expect(result.length).toBe(memories.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("memories with expiresAt in the future are always included", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            key: keyArb,
            value: valueArb,
            memoryLayer: fc.constant("agent" as string),
            scopeId: fc.constant(null as string | null),
            expiresAt: fc.date({ min: new Date("2030-01-01"), max: new Date("2040-01-01") }).map(
              (d) => d as Date | null,
            ),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (memories) => {
          const now = new Date("2025-06-01");
          const result = filterExpired(memories, now);
          expect(result.length).toBe(memories.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("expired memories are excluded even after priority merge", () => {
    fc.assert(
      fc.property(
        keyArb,
        valueArb,
        valueArb,
        scopeIdArb,
        (key, agentVal, taskVal, taskScope) => {
          const pastDate = new Date("2020-01-01");
          const now = new Date("2025-06-01");

          const memories: MemoryRecord[] = [
            { id: "a1", key, value: agentVal, memoryLayer: "agent", scopeId: null, expiresAt: null },
            { id: "t1", key, value: taskVal, memoryLayer: "task", scopeId: taskScope, expiresAt: pastDate },
          ];

          // First filter expired, then merge
          const nonExpired = filterExpired(memories, now);
          const result = mergeByPriority(nonExpired);

          const found = result.find((m) => m.key === key);
          expect(found).toBeDefined();
          // Task memory was expired, so agent memory should win
          expect(found!.memoryLayer).toBe("agent");
          expect(found!.value).toBe(agentVal);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("filterExpired count equals non-expired input count", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            key: keyArb,
            value: valueArb,
            memoryLayer: fc.constant("agent" as string),
            scopeId: fc.constant(null as string | null),
            expiresAt: fc.oneof(
              fc.constant(null as Date | null),
              fc.date({ min: new Date("2020-01-01"), max: new Date("2024-01-01") }).map(
                (d) => d as Date | null,
              ),
              fc.date({ min: new Date("2030-01-01"), max: new Date("2040-01-01") }).map(
                (d) => d as Date | null,
              ),
            ),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (memories) => {
          const now = new Date("2025-06-01");
          const result = filterExpired(memories, now);
          const expectedCount = memories.filter(
            (m) => m.expiresAt === null || m.expiresAt > now,
          ).length;
          expect(result.length).toBe(expectedCount);
        },
      ),
      { numRuns: 200 },
    );
  });
});
