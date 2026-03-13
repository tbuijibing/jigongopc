import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 15: Dependency wakeup on all blockers resolved
 *
 * For any Issue with blocks-type dependencies, when all of its blocking
 * dependencies reach done status, a Wakeup_Request SHALL be created for
 * that Issue's assignee Agent. If the Issue has no assignee, no
 * Wakeup_Request SHALL be created.
 *
 * Modelled as pure functions (no DB needed) following the pattern in
 * parent-child-completion.property.test.ts.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface Issue {
  id: string;
  companyId: string;
  assigneeAgentId: string | null;
  status: string;
}

interface Dependency {
  issueId: string; // the dependent issue (blocked issue)
  dependsOnIssueId: string; // the blocker issue
  dependencyType: string; // 'blocks' | 'relates_to' | 'required_by'
}

interface WakeupRequest {
  companyId: string;
  agentId: string;
  source: string;
  dependentIssueId: string;
  resolvedBlockerIssueId: string;
}

// ── Pure logic (mirrors CollaborationService.checkDependencyWakeup) ─────────

/**
 * Pure-function equivalent of checkDependencyWakeup in collaboration.ts.
 *
 * Given a completed issue ID, the full list of issues, and all dependencies,
 * returns the list of WakeupRequests that should be created.
 */
function checkDependencyWakeup(
  completedIssueId: string,
  allIssues: Issue[],
  allDependencies: Dependency[],
): WakeupRequest[] {
  const wakeups: WakeupRequest[] = [];

  // 1. Find all issues that depend on the completed issue via 'blocks' type
  //    i.e. rows where dependsOnIssueId = completedIssueId and dependencyType = 'blocks'
  const dependentRecords = allDependencies.filter(
    (d) => d.dependsOnIssueId === completedIssueId && d.dependencyType === "blocks",
  );

  if (dependentRecords.length === 0) return wakeups;

  // 2. For each dependent issue, check if ALL its blocks dependencies are done
  for (const dep of dependentRecords) {
    const dependentIssueId = dep.issueId;

    // Get all blocks-type dependencies for this dependent issue
    const allBlockers = allDependencies.filter(
      (d) => d.issueId === dependentIssueId && d.dependencyType === "blocks",
    );

    // Check if every blocker issue is done
    const allBlockersDone = allBlockers.every((blocker) => {
      const blockerIssue = allIssues.find((i) => i.id === blocker.dependsOnIssueId);
      return blockerIssue && blockerIssue.status === "done";
    });

    if (!allBlockersDone) continue;

    // 3. Look up the dependent issue
    const dependentIssue = allIssues.find((i) => i.id === dependentIssueId);
    if (!dependentIssue) continue;

    // 4. If dependent issue has no assignee, skip
    if (!dependentIssue.assigneeAgentId) continue;

    // 5. Create a WakeupRequest
    wakeups.push({
      companyId: dependentIssue.companyId,
      agentId: dependentIssue.assigneeAgentId,
      source: "dependency_wakeup",
      dependentIssueId: dependentIssue.id,
      resolvedBlockerIssueId: completedIssueId,
    });
  }

  return wakeups;
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.constantFrom("company-1", "company-2");
const agentIdArb = fc.constantFrom("agent-A", "agent-B", "agent-C");
const statusArb = fc.constantFrom("open", "in_progress", "done", "blocked");

/**
 * Scenario: Issue B depends on blockers A1..An (all blocks type), all blockers done.
 * B may or may not have an assignee.
 */
function allBlockersDoneScenario() {
  return fc
    .record({
      companyId: companyIdArb,
      assignee: fc.option(agentIdArb, { nil: null }),
      blockerCount: fc.integer({ min: 1, max: 6 }),
    })
    .map(({ companyId, assignee, blockerCount }) => {
      const blockers: Issue[] = Array.from({ length: blockerCount }, (_, i) => ({
        id: `blocker-${i}`,
        companyId,
        assigneeAgentId: null,
        status: "done",
      }));

      const dependentIssue: Issue = {
        id: "dependent-B",
        companyId,
        assigneeAgentId: assignee,
        status: "in_progress",
      };

      const dependencies: Dependency[] = blockers.map((b) => ({
        issueId: "dependent-B",
        dependsOnIssueId: b.id,
        dependencyType: "blocks",
      }));

      // The last blocker is the one that just completed
      const completedBlockerId = blockers[blockers.length - 1].id;

      return {
        allIssues: [...blockers, dependentIssue],
        allDependencies: dependencies,
        completedBlockerId,
        assignee,
        companyId,
      };
    });
}

/**
 * Scenario: Issue B depends on blockers A1..An, but at least one blocker is NOT done.
 */
function notAllBlockersDoneScenario() {
  return fc
    .record({
      companyId: companyIdArb,
      assignee: fc.option(agentIdArb, { nil: null }),
      blockerCount: fc.integer({ min: 2, max: 6 }),
      notDoneIndex: fc.nat(),
    })
    .map(({ companyId, assignee, blockerCount, notDoneIndex }) => {
      const targetIdx = notDoneIndex % blockerCount;

      const blockers: Issue[] = Array.from({ length: blockerCount }, (_, i) => ({
        id: `blocker-${i}`,
        companyId,
        assigneeAgentId: null,
        status: i === targetIdx ? "in_progress" : "done",
      }));

      const dependentIssue: Issue = {
        id: "dependent-B",
        companyId,
        assigneeAgentId: assignee,
        status: "in_progress",
      };

      const dependencies: Dependency[] = blockers.map((b) => ({
        issueId: "dependent-B",
        dependsOnIssueId: b.id,
        dependencyType: "blocks",
      }));

      // Complete one of the done blockers (not the notDone one)
      const doneBlocker = blockers.find((b) => b.status === "done")!;

      return {
        allIssues: [...blockers, dependentIssue],
        allDependencies: dependencies,
        completedBlockerId: doneBlocker.id,
        assignee,
      };
    });
}

/**
 * Scenario: Multiple dependent issues (B and C) share some blockers.
 * All blockers are done. Each dependent may or may not have an assignee.
 */
function multiDependentScenario() {
  return fc
    .record({
      companyId: companyIdArb,
      assigneeB: fc.option(agentIdArb, { nil: null }),
      assigneeC: fc.option(agentIdArb, { nil: null }),
    })
    .map(({ companyId, assigneeB, assigneeC }) => {
      // Shared blocker A1 blocks both B and C
      const blockerA1: Issue = { id: "blocker-A1", companyId, assigneeAgentId: null, status: "done" };

      const issueB: Issue = { id: "issue-B", companyId, assigneeAgentId: assigneeB, status: "in_progress" };
      const issueC: Issue = { id: "issue-C", companyId, assigneeAgentId: assigneeC, status: "in_progress" };

      const dependencies: Dependency[] = [
        { issueId: "issue-B", dependsOnIssueId: "blocker-A1", dependencyType: "blocks" },
        { issueId: "issue-C", dependsOnIssueId: "blocker-A1", dependencyType: "blocks" },
      ];

      return {
        allIssues: [blockerA1, issueB, issueC],
        allDependencies: dependencies,
        completedBlockerId: "blocker-A1",
        assigneeB,
        assigneeC,
        companyId,
      };
    });
}

// ── Property 15: Dependency wakeup on all blockers resolved ─────────────────

describe("Property 15: Dependency wakeup on all blockers resolved — all blocks deps done wakes assignee, no assignee means no wakeup", () => {
  it("when all blockers are done AND dependent has assignee, a WakeupRequest is created", () => {
    fc.assert(
      fc.property(
        allBlockersDoneScenario().filter((s) => s.assignee !== null),
        (scenario) => {
          const results = checkDependencyWakeup(
            scenario.completedBlockerId,
            scenario.allIssues,
            scenario.allDependencies,
          );

          expect(results).toHaveLength(1);
          expect(results[0].agentId).toBe(scenario.assignee);
          expect(results[0].companyId).toBe(scenario.companyId);
          expect(results[0].dependentIssueId).toBe("dependent-B");
          expect(results[0].resolvedBlockerIssueId).toBe(scenario.completedBlockerId);
          expect(results[0].source).toBe("dependency_wakeup");
        },
      ),
      { numRuns: 500 },
    );
  });

  it("when all blockers are done BUT dependent has no assignee, no WakeupRequest is created", () => {
    fc.assert(
      fc.property(
        allBlockersDoneScenario().filter((s) => s.assignee === null),
        (scenario) => {
          const results = checkDependencyWakeup(
            scenario.completedBlockerId,
            scenario.allIssues,
            scenario.allDependencies,
          );

          expect(results).toHaveLength(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("when NOT all blockers are done, no WakeupRequest is created regardless of assignee", () => {
    fc.assert(
      fc.property(notAllBlockersDoneScenario(), (scenario) => {
        const results = checkDependencyWakeup(
          scenario.completedBlockerId,
          scenario.allIssues,
          scenario.allDependencies,
        );

        expect(results).toHaveLength(0);
      }),
      { numRuns: 500 },
    );
  });

  it("relates_to dependencies do not trigger wakeup", () => {
    fc.assert(
      fc.property(companyIdArb, agentIdArb, (companyId, agentId) => {
        const blocker: Issue = { id: "blocker-1", companyId, assigneeAgentId: null, status: "done" };
        const dependent: Issue = { id: "dep-1", companyId, assigneeAgentId: agentId, status: "in_progress" };
        const deps: Dependency[] = [
          { issueId: "dep-1", dependsOnIssueId: "blocker-1", dependencyType: "relates_to" },
        ];

        const results = checkDependencyWakeup("blocker-1", [blocker, dependent], deps);
        expect(results).toHaveLength(0);
      }),
      { numRuns: 200 },
    );
  });

  it("issue with no dependents produces no WakeupRequest", () => {
    fc.assert(
      fc.property(companyIdArb, (companyId) => {
        const issue: Issue = { id: "standalone-1", companyId, assigneeAgentId: null, status: "done" };
        const results = checkDependencyWakeup("standalone-1", [issue], []);
        expect(results).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it("multiple dependents each get their own WakeupRequest when all blockers resolved", () => {
    fc.assert(
      fc.property(
        multiDependentScenario().filter((s) => s.assigneeB !== null && s.assigneeC !== null),
        (scenario) => {
          const results = checkDependencyWakeup(
            scenario.completedBlockerId,
            scenario.allIssues,
            scenario.allDependencies,
          );

          expect(results).toHaveLength(2);

          const wakeupB = results.find((r) => r.dependentIssueId === "issue-B");
          const wakeupC = results.find((r) => r.dependentIssueId === "issue-C");

          expect(wakeupB).toBeDefined();
          expect(wakeupB!.agentId).toBe(scenario.assigneeB);
          expect(wakeupC).toBeDefined();
          expect(wakeupC!.agentId).toBe(scenario.assigneeC);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("multiple dependents — only those with assignees get WakeupRequests", () => {
    fc.assert(
      fc.property(
        multiDependentScenario().filter((s) => s.assigneeB !== null && s.assigneeC === null),
        (scenario) => {
          const results = checkDependencyWakeup(
            scenario.completedBlockerId,
            scenario.allIssues,
            scenario.allDependencies,
          );

          expect(results).toHaveLength(1);
          expect(results[0].dependentIssueId).toBe("issue-B");
          expect(results[0].agentId).toBe(scenario.assigneeB);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("dependent issue missing from issue list produces no WakeupRequest", () => {
    fc.assert(
      fc.property(companyIdArb, (companyId) => {
        const blocker: Issue = { id: "blocker-1", companyId, assigneeAgentId: null, status: "done" };
        // Dependency references a dependent issue that doesn't exist in allIssues
        const deps: Dependency[] = [
          { issueId: "ghost-dep", dependsOnIssueId: "blocker-1", dependencyType: "blocks" },
        ];

        const results = checkDependencyWakeup("blocker-1", [blocker], deps);
        expect(results).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});
