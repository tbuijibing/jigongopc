/**
 * Feature: project-lifecycle-ui, Property 5: 依赖关系分组正确性
 *
 * For any dependency list and current issueId, grouping function correctly
 * classifies into Blocks / Blocked By / Related.
 *
 * Validates: Req 10.2
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { groupDependencies } from "../lib/dependency-grouping";
import type { IssueDependency } from "../api/issue-dependencies";

const depTypeArb = fc.constantFrom("blocks" as const, "required_by" as const, "relates_to" as const);
const uuidArb = fc.uuid();

function makeDep(
  id: string,
  issueId: string,
  dependsOnIssueId: string,
  dependencyType: "blocks" | "required_by" | "relates_to",
): IssueDependency {
  return {
    id,
    issueId,
    dependsOnIssueId,
    dependencyType,
    createdAt: new Date().toISOString(),
  };
}

describe("Property 5: dependency grouping correctness", () => {
  it("correctly classifies every dependency into Blocks/Blocked By/Related", () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(
          fc.tuple(uuidArb, uuidArb, uuidArb, depTypeArb).map(([id, issueId, depOnId, dt]) =>
            makeDep(id, issueId, depOnId, dt),
          ),
          { minLength: 0, maxLength: 20 },
        ),
        (currentIssueId, deps) => {
          const grouped = groupDependencies(deps, currentIssueId);

          // Every dependency must appear in exactly one group
          const allGrouped = [...grouped.blocks, ...grouped.blockedBy, ...grouped.related];
          expect(allGrouped.length).toBe(deps.length);

          // Verify classification rules
          for (const dep of grouped.related) {
            expect(dep.dependencyType).toBe("relates_to");
          }

          for (const dep of grouped.blocks) {
            expect(dep.dependencyType).toBe("blocks");
            expect(dep.issueId).toBe(currentIssueId);
          }

          for (const dep of grouped.blockedBy) {
            // blockedBy includes: blocks where issueId !== currentIssueId, or required_by
            if (dep.dependencyType === "blocks") {
              expect(dep.issueId).not.toBe(currentIssueId);
            }
            expect(["blocks", "required_by"]).toContain(dep.dependencyType);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
