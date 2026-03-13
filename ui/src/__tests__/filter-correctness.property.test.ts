// Feature: project-lifecycle-ui, Property 3: 过滤器正确性
// Validates: Requirements 7.2, 8.3, 9.4

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { AgentMemory, SkillRegistryEntry } from "../api/agent-six-dimensions";

// ---------------------------------------------------------------------------
// Types for Issue (issueType field exists in DB but not yet in shared types)
// ---------------------------------------------------------------------------
interface Issue {
  id: string;
  issueType: string;
}

// ---------------------------------------------------------------------------
// Pure filter functions under test
// ---------------------------------------------------------------------------

function filterMemoriesByLayer(memories: AgentMemory[], layer: string): AgentMemory[] {
  return memories.filter((m) => m.memoryLayer === layer);
}

function filterSkillsByCategory(skills: SkillRegistryEntry[], category: string): SkillRegistryEntry[] {
  return skills.filter((s) => s.category === category);
}

function filterSkillsByName(skills: SkillRegistryEntry[], search: string): SkillRegistryEntry[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => s.name.toLowerCase().includes(q));
}

function filterIssuesByType(issues: Issue[], type: string): Issue[] {
  return issues.filter((i) => i.issueType === type);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const MEMORY_LAYERS = ["agent", "project", "task"] as const;
const MEMORY_TYPES = ["fact", "preference", "learning", "context"] as const;

const memoryArb: fc.Arbitrary<AgentMemory> = fc.record({
  id: fc.uuid(),
  agentId: fc.uuid(),
  memoryLayer: fc.constantFrom(...MEMORY_LAYERS),
  scopeId: fc.option(fc.uuid(), { nil: null }),
  key: fc.string({ minLength: 1, maxLength: 50 }),
  value: fc.string({ minLength: 1, maxLength: 200 }),
  memoryType: fc.constantFrom(...MEMORY_TYPES),
  importance: fc.integer({ min: 1, max: 10 }),
  accessCount: fc.nat({ max: 1000 }),
  expiresAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  createdAt: fc.date().map((d) => d.toISOString()),
});

const SKILL_CATEGORIES = ["general", "coding", "testing", "devops", "documentation", "communication", "analysis", "design"];

const skillArb: fc.Arbitrary<SkillRegistryEntry> = fc.record({
  id: fc.uuid(),
  companyId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 60 }),
  slug: fc.string({ minLength: 1, maxLength: 60 }),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  content: fc.string({ minLength: 1, maxLength: 200 }),
  category: fc.constantFrom(...SKILL_CATEGORIES),
  version: fc.string({ minLength: 1, maxLength: 20 }),
  author: fc.option(fc.string({ maxLength: 40 }), { nil: null }),
  isBuiltin: fc.boolean(),
});

const ISSUE_TYPES = ["task", "story", "bug", "epic", "review", "approval", "document", "milestone"];

const issueArb: fc.Arbitrary<Issue> = fc.record({
  id: fc.uuid(),
  issueType: fc.constantFrom(...ISSUE_TYPES),
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Filter correctness properties", () => {
  it("filterMemoriesByLayer returns only memories of the specified layer", () => {
    fc.assert(
      fc.property(
        fc.array(memoryArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom(...MEMORY_LAYERS),
        (memories, layer) => {
          const result = filterMemoriesByLayer(memories, layer);
          // Every item in result has the correct layer
          expect(result.every((m) => m.memoryLayer === layer)).toBe(true);
          // Result count matches the count of items with that layer in the original list
          const expectedCount = memories.filter((m) => m.memoryLayer === layer).length;
          expect(result.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("filterSkillsByCategory returns only skills of the specified category", () => {
    fc.assert(
      fc.property(
        fc.array(skillArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom(...SKILL_CATEGORIES),
        (skills, category) => {
          const result = filterSkillsByCategory(skills, category);
          expect(result.every((s) => s.category === category)).toBe(true);
          const expectedCount = skills.filter((s) => s.category === category).length;
          expect(result.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("filterSkillsByName returns only skills with matching name (case-insensitive)", () => {
    fc.assert(
      fc.property(
        fc.array(skillArb, { minLength: 0, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (skills, search) => {
          const result = filterSkillsByName(skills, search);
          const q = search.trim().toLowerCase();
          if (!q) {
            // Empty search returns all
            expect(result.length).toBe(skills.length);
          } else {
            // Every result contains the search term (case-insensitive)
            expect(result.every((s) => s.name.toLowerCase().includes(q))).toBe(true);
            // Result count matches expected
            const expectedCount = skills.filter((s) => s.name.toLowerCase().includes(q)).length;
            expect(result.length).toBe(expectedCount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("filterIssuesByType returns only issues of the specified type", () => {
    fc.assert(
      fc.property(
        fc.array(issueArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom(...ISSUE_TYPES),
        (issues, type) => {
          const result = filterIssuesByType(issues, type);
          expect(result.every((i) => i.issueType === type)).toBe(true);
          const expectedCount = issues.filter((i) => i.issueType === type).length;
          expect(result.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
