// Feature: project-lifecycle-ui, Property 1: Query Key 唯一性
// Validates: Requirements 1.3

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { queryKeys } from "../lib/queryKeys";

/**
 * For any two different agentId values, all new query key factory functions
 * should produce different key arrays. Same for issue-scoped keys.
 */
describe("Query Key uniqueness properties", () => {
  // Helper: deep-compare two readonly arrays
  function arraysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }

  it("agent-scoped keys produce unique arrays for different agentId values", () => {
    const agentKeyFactories = [
      queryKeys.agents.heartbeatConfig,
      queryKeys.agents.soul,
      queryKeys.agents.tools,
      queryKeys.agents.skills,
      queryKeys.agents.memories,
      queryKeys.agents.controllers,
    ] as const;

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (idA, idB) => {
          fc.pre(idA !== idB);

          for (const factory of agentKeyFactories) {
            const keyA = factory(idA);
            const keyB = factory(idB);
            expect(arraysEqual(keyA, keyB)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("issue-scoped keys produce unique arrays for different issueId values", () => {
    const issueKeyFactories = [
      queryKeys.issues.dependencies,
      queryKeys.issues.watchers,
    ] as const;

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (idA, idB) => {
          fc.pre(idA !== idB);

          for (const factory of issueKeyFactories) {
            const keyA = factory(idA);
            const keyB = factory(idB);
            expect(arraysEqual(keyA, keyB)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("skillStore keys produce unique arrays for different companyId values", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (idA, idB) => {
          fc.pre(idA !== idB);

          const keyA = queryKeys.skillStore(idA);
          const keyB = queryKeys.skillStore(idB);
          expect(arraysEqual(keyA, keyB)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("all agent-scoped key factories produce mutually distinct keys for the same agentId", () => {
    const agentKeyFactories = [
      queryKeys.agents.heartbeatConfig,
      queryKeys.agents.soul,
      queryKeys.agents.tools,
      queryKeys.agents.skills,
      queryKeys.agents.memories,
      queryKeys.agents.controllers,
    ] as const;

    fc.assert(
      fc.property(
        fc.uuid(),
        (agentId) => {
          const keys = agentKeyFactories.map((f) => f(agentId));
          // Every pair should be different
          for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
              expect(arraysEqual(keys[i]!, keys[j]!)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
