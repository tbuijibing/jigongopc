import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 14: Parent-child completion wakeup
 *
 * For any parent Issue whose children all transition to done status,
 * a Wakeup_Request SHALL be created for the parent Issue's assignee Agent.
 * If the parent has no assignee, no Wakeup_Request SHALL be created.
 *
 * Modelled as pure functions (no DB needed) following the pattern in
 * issue-watcher.property.test.ts and issue-dependency.property.test.ts.
 *
 * **Validates: Requirements 11.1, 11.2, 11.3**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface Issue {
  id: string;
  companyId: string;
  parentId: string | null;
  assigneeAgentId: string | null;
  status: string;
}

interface WakeupRequest {
  companyId: string;
  agentId: string;
  source: string;
  parentIssueId: string;
  completedChildIssueId: string;
}

// ── Pure logic (mirrors CollaborationService.checkParentChildCompletion) ────

/**
 * Pure-function equivalent of checkParentChildCompletion in collaboration.ts.
 *
 * Given a completed child issue and the full list of issues, determines
 * whether a WakeupRequest should be created for the parent's assignee.
 */
function checkParentChildCompletion(
  completedIssueId: string,
  allIssues: Issue[],
): WakeupRequest | null {
  // 1. Look up the completed issue
  const issue = allIssues.find((i) => i.id === completedIssueId);
  if (!issue) return null;

  // 2. If no parentId, nothing to do
  if (!issue.parentId) return null;

  // 3. Query all sibling issues (same parentId)
  const siblings = allIssues.filter((i) => i.parentId === issue.parentId);

  // 4. Check if ALL siblings have status 'done'
  const allDone = siblings.length > 0 && siblings.every((s) => s.status === "done");
  if (!allDone) return null;

  // 5. Look up the parent issue
  const parent = allIssues.find((i) => i.id === issue.parentId);
  if (!parent) return null;

  // 6. If parent has no assignee, skip
  if (!parent.assigneeAgentId) return null;

  // 7. Create a WakeupRequest
  return {
    companyId: parent.companyId,
    agentId: parent.assigneeAgentId,
    source: "parent_child_completion",
    parentIssueId: parent.id,
    completedChildIssueId: completedIssueId,
  };
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.constantFrom("company-1", "company-2");
const agentIdArb = fc.constantFrom("agent-A", "agent-B", "agent-C");
const statusArb = fc.constantFrom("open", "in_progress", "done", "blocked");

/**
 * Generate a parent issue with N children where all children are done.
 * Parent may or may not have an assignee.
 */
function allChildrenDoneScenario() {
  return fc.record({
    companyId: companyIdArb,
    parentAssignee: fc.option(agentIdArb, { nil: null }),
    childCount: fc.integer({ min: 1, max: 8 }),
  }).map(({ companyId, parentAssignee, childCount }) => {
    const parentId = "parent-1";
    const parent: Issue = {
      id: parentId,
      companyId,
      parentId: null,
      assigneeAgentId: parentAssignee,
      status: "in_progress",
    };

    const children: Issue[] = Array.from({ length: childCount }, (_, i) => ({
      id: `child-${i}`,
      companyId,
      parentId,
      assigneeAgentId: null,
      status: "done",
    }));

    // The last child is the one that just completed
    const completedChildId = children[children.length - 1].id;

    return {
      allIssues: [parent, ...children],
      completedChildId,
      parentAssignee,
      companyId,
      parentId,
    };
  });
}

/**
 * Generate a parent issue with N children where at least one child is NOT done.
 */
function notAllChildrenDoneScenario() {
  return fc.record({
    companyId: companyIdArb,
    parentAssignee: fc.option(agentIdArb, { nil: null }),
    childCount: fc.integer({ min: 2, max: 8 }),
    notDoneIndex: fc.nat(),
  }).map(({ companyId, parentAssignee, childCount, notDoneIndex }) => {
    const parentId = "parent-1";
    const parent: Issue = {
      id: parentId,
      companyId,
      parentId: null,
      assigneeAgentId: parentAssignee,
      status: "in_progress",
    };

    // Pick which child will NOT be done
    const targetIdx = notDoneIndex % childCount;

    const children: Issue[] = Array.from({ length: childCount }, (_, i) => ({
      id: `child-${i}`,
      companyId,
      parentId,
      assigneeAgentId: null,
      status: i === targetIdx ? "in_progress" : "done",
    }));

    // The completed child is one of the done children (not the notDone one)
    const doneChild = children.find((c) => c.status === "done")!;

    return {
      allIssues: [parent, ...children],
      completedChildId: doneChild.id,
      parentAssignee,
    };
  });
}

// ── Property 14: Parent-child completion wakeup ─────────────────────────────

describe("Property 14: Parent-child completion wakeup — all children done wakes parent assignee, no assignee means no wakeup", () => {
  it("when all children are done AND parent has assignee, a WakeupRequest is created", () => {
    fc.assert(
      fc.property(
        allChildrenDoneScenario().filter((s) => s.parentAssignee !== null),
        (scenario) => {
          const result = checkParentChildCompletion(
            scenario.completedChildId,
            scenario.allIssues,
          );

          expect(result).not.toBeNull();
          expect(result!.agentId).toBe(scenario.parentAssignee);
          expect(result!.companyId).toBe(scenario.companyId);
          expect(result!.parentIssueId).toBe(scenario.parentId);
          expect(result!.completedChildIssueId).toBe(scenario.completedChildId);
          expect(result!.source).toBe("parent_child_completion");
        },
      ),
      { numRuns: 500 },
    );
  });

  it("when all children are done BUT parent has no assignee, no WakeupRequest is created", () => {
    fc.assert(
      fc.property(
        allChildrenDoneScenario().filter((s) => s.parentAssignee === null),
        (scenario) => {
          const result = checkParentChildCompletion(
            scenario.completedChildId,
            scenario.allIssues,
          );

          expect(result).toBeNull();
        },
      ),
      { numRuns: 500 },
    );
  });

  it("when NOT all children are done, no WakeupRequest is created regardless of parent assignee", () => {
    fc.assert(
      fc.property(
        notAllChildrenDoneScenario(),
        (scenario) => {
          const result = checkParentChildCompletion(
            scenario.completedChildId,
            scenario.allIssues,
          );

          expect(result).toBeNull();
        },
      ),
      { numRuns: 500 },
    );
  });

  it("issue with no parent produces no WakeupRequest", () => {
    fc.assert(
      fc.property(companyIdArb, statusArb, (companyId, status) => {
        const orphan: Issue = {
          id: "orphan-1",
          companyId,
          parentId: null,
          assigneeAgentId: null,
          status,
        };

        const result = checkParentChildCompletion("orphan-1", [orphan]);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("non-existent issue ID produces no WakeupRequest", () => {
    fc.assert(
      fc.property(
        allChildrenDoneScenario(),
        (scenario) => {
          const result = checkParentChildCompletion(
            "non-existent-id",
            scenario.allIssues,
          );

          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("WakeupRequest references the correct parent and completed child", () => {
    fc.assert(
      fc.property(
        allChildrenDoneScenario().filter((s) => s.parentAssignee !== null),
        (scenario) => {
          const result = checkParentChildCompletion(
            scenario.completedChildId,
            scenario.allIssues,
          );

          expect(result).not.toBeNull();
          // Parent issue ID matches
          expect(result!.parentIssueId).toBe(scenario.parentId);
          // Completed child ID matches
          expect(result!.completedChildIssueId).toBe(scenario.completedChildId);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("single child done with parent assignee produces WakeupRequest", () => {
    fc.assert(
      fc.property(companyIdArb, agentIdArb, (companyId, agentId) => {
        const parent: Issue = {
          id: "parent-1",
          companyId,
          parentId: null,
          assigneeAgentId: agentId,
          status: "in_progress",
        };
        const child: Issue = {
          id: "child-0",
          companyId,
          parentId: "parent-1",
          assigneeAgentId: null,
          status: "done",
        };

        const result = checkParentChildCompletion("child-0", [parent, child]);

        expect(result).not.toBeNull();
        expect(result!.agentId).toBe(agentId);
        expect(result!.parentIssueId).toBe("parent-1");
      }),
      { numRuns: 200 },
    );
  });

  it("parent missing from issue list produces no WakeupRequest even if all children done", () => {
    fc.assert(
      fc.property(companyIdArb, (companyId) => {
        // Children reference a parent that doesn't exist in the list
        const children: Issue[] = [
          { id: "child-0", companyId, parentId: "ghost-parent", assigneeAgentId: null, status: "done" },
          { id: "child-1", companyId, parentId: "ghost-parent", assigneeAgentId: null, status: "done" },
        ];

        const result = checkParentChildCompletion("child-0", children);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
