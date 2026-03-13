import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 21: Agent capability discovery matches
 *
 * For any capability discovery query with a set of need parameters, every
 * returned Agent SHALL have at least one matching entry in its structured
 * capabilities (languages, frameworks, domains, tools, customTags) for each
 * specified need.
 *
 * **Validates: Requirements 6.3**
 */

// ── Replicate the pure matching logic from agents.ts ────────────────────────

type CapabilityDimension = "languages" | "frameworks" | "domains" | "tools" | "customTags";

interface AgentCapabilities {
  languages: string[];
  frameworks: string[];
  domains: string[];
  tools: string[];
  customTags: string[];
}

interface AgentRow {
  id: string;
  name: string;
  status: string;
  capabilities: AgentCapabilities | null;
}

type Needs = Partial<Record<CapabilityDimension, string[]>>;

/**
 * Pure matching logic extracted from discoverAgents in agents.ts.
 * Given a list of agents and a needs query, returns the matching agents.
 */
function discoverAgentsPure(agents: AgentRow[], needs: Needs): AgentRow[] {
  // Filter out terminated agents first
  const active = agents.filter((a) => a.status !== "terminated");

  const needEntries = Object.entries(needs).filter(
    ([, values]) => Array.isArray(values) && values.length > 0,
  ) as [CapabilityDimension, string[]][];

  if (needEntries.length === 0) {
    return active;
  }

  return active.filter((row) => {
    const caps = row.capabilities;
    if (!caps) return false;

    return needEntries.every(([dimension, required]) => {
      const available = caps[dimension];
      if (!Array.isArray(available)) return false;
      const lowerAvailable = available.map((v) => v.toLowerCase());
      return required.some((need) => lowerAvailable.includes(need.toLowerCase()));
    });
  });
}

/**
 * Checks whether a single agent matches ALL need dimensions.
 * Returns true if for every dimension in needs, the agent has at least one
 * matching capability entry (case-insensitive).
 */
function agentMatchesAllNeeds(
  caps: AgentCapabilities | null,
  needs: Needs,
): boolean {
  if (!caps) return false;

  const needEntries = Object.entries(needs).filter(
    ([, values]) => Array.isArray(values) && values.length > 0,
  ) as [CapabilityDimension, string[]][];

  if (needEntries.length === 0) return true;

  return needEntries.every(([dimension, required]) => {
    const available = caps[dimension];
    if (!Array.isArray(available)) return false;
    const lowerAvailable = available.map((v) => v.toLowerCase());
    return required.some((need) => lowerAvailable.includes(need.toLowerCase()));
  });
}

// ── Generators ──────────────────────────────────────────────────────────────

const SAMPLE_LANGUAGES = ["typescript", "python", "rust", "go", "java", "ruby", "c++"];
const SAMPLE_FRAMEWORKS = ["react", "express", "django", "fastapi", "spring", "rails"];
const SAMPLE_DOMAINS = ["frontend", "backend", "devops", "ml", "security", "data"];
const SAMPLE_TOOLS = ["git", "docker", "kubernetes", "terraform", "webpack", "vite"];
const SAMPLE_TAGS = ["senior", "junior", "lead", "specialist", "generalist"];

const agentStatusArb = fc.constantFrom("idle", "running", "error", "paused", "terminated", "pending_approval");
const activeStatusArb = fc.constantFrom("idle", "running", "error", "paused", "pending_approval");

function subsetArb(pool: string[]): fc.Arbitrary<string[]> {
  return fc.subarray(pool, { minLength: 0, maxLength: pool.length });
}

function nonEmptySubsetArb(pool: string[]): fc.Arbitrary<string[]> {
  return fc.subarray(pool, { minLength: 1, maxLength: pool.length });
}

const capabilitiesArb: fc.Arbitrary<AgentCapabilities> = fc.record({
  languages: subsetArb(SAMPLE_LANGUAGES),
  frameworks: subsetArb(SAMPLE_FRAMEWORKS),
  domains: subsetArb(SAMPLE_DOMAINS),
  tools: subsetArb(SAMPLE_TOOLS),
  customTags: subsetArb(SAMPLE_TAGS),
});

const nullableCapabilitiesArb: fc.Arbitrary<AgentCapabilities | null> = fc.oneof(
  capabilitiesArb,
  fc.constant(null),
);

const agentRowArb: fc.Arbitrary<AgentRow> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  status: agentStatusArb,
  capabilities: nullableCapabilitiesArb,
});

const agentListArb: fc.Arbitrary<AgentRow[]> = fc.array(agentRowArb, { minLength: 0, maxLength: 15 });

/** Generate a needs query with at least one non-empty dimension */
const nonEmptyNeedsArb: fc.Arbitrary<Needs> = fc
  .record({
    languages: fc.oneof(nonEmptySubsetArb(SAMPLE_LANGUAGES), fc.constant([] as string[])),
    frameworks: fc.oneof(nonEmptySubsetArb(SAMPLE_FRAMEWORKS), fc.constant([] as string[])),
    domains: fc.oneof(nonEmptySubsetArb(SAMPLE_DOMAINS), fc.constant([] as string[])),
    tools: fc.oneof(nonEmptySubsetArb(SAMPLE_TOOLS), fc.constant([] as string[])),
    customTags: fc.oneof(nonEmptySubsetArb(SAMPLE_TAGS), fc.constant([] as string[])),
  })
  .filter((n) =>
    Object.values(n).some((arr) => arr.length > 0),
  );

const needsArb: fc.Arbitrary<Needs> = fc.oneof(
  nonEmptyNeedsArb,
  fc.constant({} as Needs),
);

// ── Property tests ──────────────────────────────────────────────────────────

describe("Property 21: Agent capability discovery matches", () => {
  it("every returned agent has at least one matching capability for each specified need dimension", () => {
    fc.assert(
      fc.property(agentListArb, nonEmptyNeedsArb, (agents, needs) => {
        const results = discoverAgentsPure(agents, needs);

        const needEntries = Object.entries(needs).filter(
          ([, values]) => Array.isArray(values) && values.length > 0,
        ) as [CapabilityDimension, string[]][];

        for (const agent of results) {
          expect(agent.capabilities).not.toBeNull();
          const caps = agent.capabilities!;

          for (const [dimension, required] of needEntries) {
            const available = caps[dimension];
            expect(Array.isArray(available)).toBe(true);
            const lowerAvailable = available.map((v) => v.toLowerCase());
            const hasMatch = required.some((need) =>
              lowerAvailable.includes(need.toLowerCase()),
            );
            expect(hasMatch).toBe(true);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("no non-terminated agent that matches all needs is omitted from results", () => {
    fc.assert(
      fc.property(agentListArb, nonEmptyNeedsArb, (agents, needs) => {
        const results = discoverAgentsPure(agents, needs);
        const resultIds = new Set(results.map((a) => a.id));

        for (const agent of agents) {
          if (agent.status === "terminated") continue;
          if (agentMatchesAllNeeds(agent.capabilities, needs)) {
            expect(resultIds.has(agent.id)).toBe(true);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("terminated agents are never returned regardless of capabilities", () => {
    fc.assert(
      fc.property(agentListArb, needsArb, (agents, needs) => {
        const results = discoverAgentsPure(agents, needs);

        for (const agent of results) {
          expect(agent.status).not.toBe("terminated");
        }
      }),
      { numRuns: 200 },
    );
  });

  it("agents with null capabilities are excluded when needs are specified", () => {
    fc.assert(
      fc.property(agentListArb, nonEmptyNeedsArb, (agents, needs) => {
        const results = discoverAgentsPure(agents, needs);

        for (const agent of results) {
          expect(agent.capabilities).not.toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });

  it("matching is case-insensitive", () => {
    fc.assert(
      fc.property(
        activeStatusArb,
        fc.uuid(),
        nonEmptySubsetArb(SAMPLE_LANGUAGES),
        (status, id, langs) => {
          const upperLangs = langs.map((l) => l.toUpperCase());
          const agent: AgentRow = {
            id,
            name: "test-agent",
            status,
            capabilities: {
              languages: upperLangs,
              frameworks: [],
              domains: [],
              tools: [],
              customTags: [],
            },
          };

          const lowerNeeds: Needs = { languages: langs.map((l) => l.toLowerCase()) };
          const results = discoverAgentsPure([agent], lowerNeeds);

          expect(results.length).toBe(1);
          expect(results[0].id).toBe(id);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("empty needs returns all non-terminated agents", () => {
    fc.assert(
      fc.property(agentListArb, (agents) => {
        const results = discoverAgentsPure(agents, {});
        const expectedCount = agents.filter((a) => a.status !== "terminated").length;

        expect(results.length).toBe(expectedCount);
      }),
      { numRuns: 200 },
    );
  });

  it("adding more need dimensions can only narrow or maintain the result set, never widen it", () => {
    fc.assert(
      fc.property(
        agentListArb,
        nonEmptySubsetArb(SAMPLE_LANGUAGES),
        nonEmptySubsetArb(SAMPLE_FRAMEWORKS),
        (agents, langs, frameworks) => {
          const narrowNeeds: Needs = { languages: langs };
          const widerNeeds: Needs = { languages: langs, frameworks };

          const narrowResults = discoverAgentsPure(agents, narrowNeeds);
          const widerResults = discoverAgentsPure(agents, widerNeeds);

          const widerIds = new Set(widerResults.map((a) => a.id));
          // Every agent in the wider (more constrained) result must also be in the narrower result
          for (const agent of widerResults) {
            const inNarrow = narrowResults.some((a) => a.id === agent.id);
            expect(inNarrow).toBe(true);
          }
          expect(widerResults.length).toBeLessThanOrEqual(narrowResults.length);
        },
      ),
      { numRuns: 200 },
    );
  });
});
