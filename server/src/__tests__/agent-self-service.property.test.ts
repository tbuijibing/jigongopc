import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 24: Agent self-service memory round-trip
 *
 * For any Agent, writing a memory and then reading it SHALL return the same
 * memory content. The Agent SHALL only see memories belonging to itself
 * within its own company.
 *
 * Property 2: Company-scoped isolation (agent self-service perspective)
 *
 * Agent actors can only access data within their own company. An agent in
 * company1 SHALL NOT see memories or capabilities from company2.
 *
 * Pure-function model — no DB required.
 *
 * **Validates: Requirements 19.1, 19.2, 19.5, 19.6**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface AgentIdentity {
  agentId: string;
  companyId: string;
}

interface MemoryEntry {
  id: string;
  companyId: string;
  agentId: string;
  memoryLayer: "agent" | "project" | "task";
  scopeId: string | null;
  key: string;
  value: string;
}

interface CapabilityEntry {
  agentId: string;
  companyId: string;
  capabilities: { languages: string[]; frameworks: string[] };
}

// ── Pure-function memory store model ────────────────────────────────────────

type MemoryStore = Map<string, MemoryEntry[]>; // keyed by agentId

function writeMemory(store: MemoryStore, entry: MemoryEntry): MemoryStore {
  const next = new Map(store);
  const existing = next.get(entry.agentId) ?? [];
  next.set(entry.agentId, [...existing, entry]);
  return next;
}

function readMemories(
  store: MemoryStore,
  actor: AgentIdentity,
): MemoryEntry[] {
  const all = store.get(actor.agentId) ?? [];
  // Agent can only see its own memories within its own company
  return all.filter(
    (m) => m.agentId === actor.agentId && m.companyId === actor.companyId,
  );
}

// ── Pure-function capability store model ────────────────────────────────────

function discoverCapabilities(
  allCapabilities: CapabilityEntry[],
  actor: AgentIdentity,
): CapabilityEntry[] {
  // Agent can only see capabilities from its own company
  return allCapabilities.filter((c) => c.companyId === actor.companyId);
}

// ── Generators ──────────────────────────────────────────────────────────────

const agentIdentityArb: fc.Arbitrary<AgentIdentity> = fc.record({
  agentId: fc.uuid(),
  companyId: fc.uuid(),
});

const memoryLayerArb = fc.constantFrom(
  "agent" as const,
  "project" as const,
  "task" as const,
);

const memoryEntryArb = (agent: AgentIdentity): fc.Arbitrary<MemoryEntry> =>
  fc.record({
    id: fc.uuid(),
    companyId: fc.constant(agent.companyId),
    agentId: fc.constant(agent.agentId),
    memoryLayer: memoryLayerArb,
    scopeId: fc.option(fc.uuid(), { nil: null }),
    key: fc.string({ minLength: 1, maxLength: 30 }),
    value: fc.string({ minLength: 1, maxLength: 100 }),
  });

const capabilityEntryArb = (companyId: string): fc.Arbitrary<CapabilityEntry> =>
  fc.record({
    agentId: fc.uuid(),
    companyId: fc.constant(companyId),
    capabilities: fc.record({
      languages: fc.array(fc.constantFrom("typescript", "python", "go", "rust"), {
        minLength: 0,
        maxLength: 3,
      }),
      frameworks: fc.array(fc.constantFrom("react", "express", "django", "gin"), {
        minLength: 0,
        maxLength: 3,
      }),
    }),
  });

// ── Property tests ──────────────────────────────────────────────────────────

describe("Property 24: Agent self-service memory round-trip", () => {
  it("agent reads back the same memory it wrote", () => {
    fc.assert(
      fc.property(
        agentIdentityArb,
        fc.integer({ min: 1, max: 5 }),
        (agent, count) => {
          let store: MemoryStore = new Map();

          // Generate and write N memories
          const written: MemoryEntry[] = [];
          for (let i = 0; i < count; i++) {
            const entry: MemoryEntry = {
              id: `mem-${i}`,
              companyId: agent.companyId,
              agentId: agent.agentId,
              memoryLayer: "agent",
              scopeId: null,
              key: `key-${i}`,
              value: `value-${i}`,
            };
            store = writeMemory(store, entry);
            written.push(entry);
          }

          // Read back
          const result = readMemories(store, agent);

          // Every written memory should be present
          for (const w of written) {
            const found = result.find((r) => r.id === w.id);
            expect(found).toBeDefined();
            expect(found!.key).toBe(w.key);
            expect(found!.value).toBe(w.value);
            expect(found!.memoryLayer).toBe(w.memoryLayer);
          }
          expect(result.length).toBe(written.length);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("agent cannot see another agent's memories", () => {
    fc.assert(
      fc.property(
        agentIdentityArb,
        agentIdentityArb,
        (agentA, agentB) => {
          // Ensure distinct agents
          fc.pre(agentA.agentId !== agentB.agentId);

          // Write a memory for agentA
          let store: MemoryStore = new Map();
          const entryA: MemoryEntry = {
            id: "mem-a",
            companyId: agentA.companyId,
            agentId: agentA.agentId,
            memoryLayer: "agent",
            scopeId: null,
            key: "secret",
            value: "agentA-data",
          };
          store = writeMemory(store, entryA);

          // agentB reads — should see nothing from agentA
          const resultB = readMemories(store, agentB);
          const leaked = resultB.find((m) => m.agentId === agentA.agentId);
          expect(leaked).toBeUndefined();
        },
      ),
      { numRuns: 500 },
    );
  });

  it("agent reads only its own memories even when store has multiple agents", () => {
    fc.assert(
      fc.property(
        agentIdentityArb,
        agentIdentityArb,
        (agentA, agentB) => {
          fc.pre(agentA.agentId !== agentB.agentId);

          let store: MemoryStore = new Map();

          // Write memories for both agents
          const entryA: MemoryEntry = {
            id: "mem-a",
            companyId: agentA.companyId,
            agentId: agentA.agentId,
            memoryLayer: "task",
            scopeId: "issue-1",
            key: "progress",
            value: "50%",
          };
          const entryB: MemoryEntry = {
            id: "mem-b",
            companyId: agentB.companyId,
            agentId: agentB.agentId,
            memoryLayer: "project",
            scopeId: "proj-1",
            key: "architecture",
            value: "microservices",
          };
          store = writeMemory(store, entryA);
          store = writeMemory(store, entryB);

          // Each agent sees only its own
          const resultA = readMemories(store, agentA);
          const resultB = readMemories(store, agentB);

          expect(resultA.every((m) => m.agentId === agentA.agentId)).toBe(true);
          expect(resultB.every((m) => m.agentId === agentB.agentId)).toBe(true);
          expect(resultA.length).toBe(1);
          expect(resultB.length).toBe(1);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("Property 2: Company-scoped isolation — Agent self-service API", () => {
  it("agent only sees capabilities from its own company", () => {
    fc.assert(
      fc.property(
        agentIdentityArb,
        fc.uuid(),
        (actor, otherCompanyId) => {
          fc.pre(actor.companyId !== otherCompanyId);

          // Capabilities from two companies
          const ownCap: CapabilityEntry = {
            agentId: "agent-own",
            companyId: actor.companyId,
            capabilities: { languages: ["typescript"], frameworks: ["react"] },
          };
          const otherCap: CapabilityEntry = {
            agentId: "agent-other",
            companyId: otherCompanyId,
            capabilities: { languages: ["python"], frameworks: ["django"] },
          };

          const result = discoverCapabilities([ownCap, otherCap], actor);

          // Should only see own company's capabilities
          expect(result.every((c) => c.companyId === actor.companyId)).toBe(true);
          expect(result.some((c) => c.companyId === otherCompanyId)).toBe(false);
          expect(result.length).toBe(1);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("agent in company1 cannot see memories scoped to company2", () => {
    fc.assert(
      fc.property(
        agentIdentityArb,
        fc.uuid(),
        (agent, otherCompanyId) => {
          fc.pre(agent.companyId !== otherCompanyId);

          // Write a memory under the same agentId but different company
          let store: MemoryStore = new Map();
          const crossCompanyEntry: MemoryEntry = {
            id: "mem-cross",
            companyId: otherCompanyId,
            agentId: agent.agentId, // same agentId, different company
            memoryLayer: "agent",
            scopeId: null,
            key: "cross-company-secret",
            value: "should-not-see",
          };
          store = writeMemory(store, crossCompanyEntry);

          // Agent reads with its own company scope — should see nothing
          const result = readMemories(store, agent);
          expect(result.length).toBe(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("multiple agents across companies see only their own company data", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.array(agentIdentityArb, { minLength: 2, maxLength: 6 }),
        (company1, company2, agents) => {
          fc.pre(company1 !== company2);

          // Assign agents to alternating companies
          const allCaps: CapabilityEntry[] = agents.map((a, i) => ({
            agentId: a.agentId,
            companyId: i % 2 === 0 ? company1 : company2,
            capabilities: {
              languages: ["typescript"],
              frameworks: ["react"],
            },
          }));

          // An agent from company1 should only see company1 capabilities
          const actor1: AgentIdentity = { agentId: "viewer", companyId: company1 };
          const result1 = discoverCapabilities(allCaps, actor1);
          expect(result1.every((c) => c.companyId === company1)).toBe(true);

          // An agent from company2 should only see company2 capabilities
          const actor2: AgentIdentity = { agentId: "viewer", companyId: company2 };
          const result2 = discoverCapabilities(allCaps, actor2);
          expect(result2.every((c) => c.companyId === company2)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
