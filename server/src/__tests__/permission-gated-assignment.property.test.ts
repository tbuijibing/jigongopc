import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 17: Permission-gated task assignment
 *
 * For any human attempting to assign an Issue to an Agent, the assignment
 * SHALL succeed only if the human has a Human_Agent_Control record with
 * canAssignTasks=true for that Agent. Successful assignment SHALL create
 * a Wakeup_Request. Missing permission SHALL result in a 403 error.
 *
 * Modelled as pure functions (no DB) following the pattern in
 * human-agent-control.property.test.ts and agent-blocked.property.test.ts.
 *
 * **Validates: Requirements 16.1, 16.2, 16.3**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface HumanAgentControl {
  companyId: string;
  userId: string;
  agentId: string;
  canAssignTasks: boolean;
}

interface WakeupRequest {
  companyId: string;
  agentId: string;
  issueId: string;
  requestedByUserId: string;
}

type AssignmentResult =
  | { success: true; wakeup: WakeupRequest }
  | { success: false; errorCode: 403 };

// ── Pure logic (mirrors issueService.assertHumanCanAssignToAgent + createAssignmentWakeup) ──

/**
 * Look up the control record for a (companyId, userId, agentId) triple.
 * Mirrors the DB query in assertHumanCanAssignToAgent.
 */
function findControl(
  controls: HumanAgentControl[],
  companyId: string,
  userId: string,
  agentId: string,
): HumanAgentControl | null {
  return (
    controls.find(
      (c) =>
        c.companyId === companyId &&
        c.userId === userId &&
        c.agentId === agentId,
    ) ?? null
  );
}

/**
 * Pure-function equivalent of the assignment flow in issueService.update:
 * 1. assertHumanCanAssignToAgent — checks control record + canAssignTasks
 * 2. createAssignmentWakeup — inserts a WakeupRequest on success
 */
function tryAssignIssueToAgent(
  controls: HumanAgentControl[],
  companyId: string,
  userId: string,
  agentId: string,
  issueId: string,
): AssignmentResult {
  const control = findControl(controls, companyId, userId, agentId);

  // No control relationship → 403
  if (!control) {
    return { success: false, errorCode: 403 };
  }

  // Control exists but canAssignTasks is false → 403
  if (!control.canAssignTasks) {
    return { success: false, errorCode: 403 };
  }

  // Permission granted → assignment succeeds, create wakeup
  return {
    success: true,
    wakeup: {
      companyId,
      agentId,
      issueId,
      requestedByUserId: userId,
    },
  };
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.constantFrom("company-1", "company-2");
const agentIdArb = fc.constantFrom("agent-A", "agent-B", "agent-C");
const userIdArb = fc.constantFrom("user-1", "user-2", "user-3", "user-4");
const issueIdArb = fc.constantFrom("issue-1", "issue-2", "issue-3");

const controlArb: fc.Arbitrary<HumanAgentControl> = fc.record({
  companyId: companyIdArb,
  userId: userIdArb,
  agentId: agentIdArb,
  canAssignTasks: fc.boolean(),
});

const controlListArb = fc.array(controlArb, { minLength: 0, maxLength: 12 }).map((list) =>
  // Deduplicate by (companyId, userId, agentId) — mirrors unique constraint
  list.filter(
    (c, i, arr) =>
      arr.findIndex(
        (x) =>
          x.companyId === c.companyId &&
          x.userId === c.userId &&
          x.agentId === c.agentId,
      ) === i,
  ),
);

// ── Property 17: Permission-gated task assignment ───────────────────────────

describe("Property 17: Permission-gated task assignment", () => {
  it("assignment succeeds and creates WakeupRequest when canAssignTasks=true", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        userIdArb,
        agentIdArb,
        issueIdArb,
        (companyId, userId, agentId, issueId) => {
          const controls: HumanAgentControl[] = [
            { companyId, userId, agentId, canAssignTasks: true },
          ];

          const result = tryAssignIssueToAgent(controls, companyId, userId, agentId, issueId);

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.wakeup.companyId).toBe(companyId);
            expect(result.wakeup.agentId).toBe(agentId);
            expect(result.wakeup.issueId).toBe(issueId);
            expect(result.wakeup.requestedByUserId).toBe(userId);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("assignment returns 403 when canAssignTasks=false", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        userIdArb,
        agentIdArb,
        issueIdArb,
        (companyId, userId, agentId, issueId) => {
          const controls: HumanAgentControl[] = [
            { companyId, userId, agentId, canAssignTasks: false },
          ];

          const result = tryAssignIssueToAgent(controls, companyId, userId, agentId, issueId);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.errorCode).toBe(403);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("assignment returns 403 when no control record exists", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        userIdArb,
        agentIdArb,
        issueIdArb,
        controlListArb,
        (companyId, userId, agentId, issueId, controls) => {
          // Remove any control for this specific (companyId, userId, agentId)
          const filtered = controls.filter(
            (c) =>
              !(c.companyId === companyId && c.userId === userId && c.agentId === agentId),
          );

          const result = tryAssignIssueToAgent(filtered, companyId, userId, agentId, issueId);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.errorCode).toBe(403);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("result is fully determined by the control record's canAssignTasks value", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        userIdArb,
        agentIdArb,
        issueIdArb,
        controlListArb,
        (companyId, userId, agentId, issueId, controls) => {
          const result = tryAssignIssueToAgent(controls, companyId, userId, agentId, issueId);
          const control = findControl(controls, companyId, userId, agentId);

          if (control && control.canAssignTasks) {
            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.wakeup.agentId).toBe(agentId);
            }
          } else {
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.errorCode).toBe(403);
            }
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("wakeup is only created on successful assignment, never on 403", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        userIdArb,
        agentIdArb,
        issueIdArb,
        fc.boolean(),
        (companyId, userId, agentId, issueId, canAssign) => {
          const controls: HumanAgentControl[] = [
            { companyId, userId, agentId, canAssignTasks: canAssign },
          ];

          const result = tryAssignIssueToAgent(controls, companyId, userId, agentId, issueId);

          if (canAssign) {
            expect(result.success).toBe(true);
            expect((result as any).wakeup).toBeDefined();
          } else {
            expect(result.success).toBe(false);
            expect((result as any).wakeup).toBeUndefined();
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
