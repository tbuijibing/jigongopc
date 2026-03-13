import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 18: Blocked agent notifies primary controller
 *
 * For any Agent that enters blocked status and has a primary controller
 * (isPrimary=true), a blocked notification SHALL be created for that
 * primary controller's userId. If no primary controller exists, no
 * notification is created.
 *
 * Modelled as pure functions (no DB) following the pattern in
 * human-agent-control.property.test.ts.
 *
 * **Validates: Requirements 15.1, 15.2, 15.3**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface HumanAgentControl {
  userId: string;
  agentId: string;
  isPrimary: boolean;
}

interface BlockedResult {
  notified: boolean;
  userId: string | null;
}

// ── Pure logic (mirrors agentBlockedService.onAgentBlocked) ─────────────────

/**
 * Find the primary controller for an agent from a list of controls.
 * Mirrors humanAgentControlService.findPrimaryController.
 */
function findPrimaryController(
  controls: HumanAgentControl[],
  agentId: string,
): HumanAgentControl | null {
  return controls.find((c) => c.agentId === agentId && c.isPrimary) ?? null;
}

/**
 * Pure-function equivalent of agentBlockedService.onAgentBlocked.
 * Returns the notification result without DB side effects.
 */
function onAgentBlocked(
  controls: HumanAgentControl[],
  agentId: string,
  _reason: string,
): BlockedResult {
  const primary = findPrimaryController(controls, agentId);
  if (primary) {
    return { notified: true, userId: primary.userId };
  }
  return { notified: false, userId: null };
}

// ── Generators ──────────────────────────────────────────────────────────────

const agentIdArb = fc.constantFrom("agent-A", "agent-B", "agent-C");
const userIdArb = fc.constantFrom("user-1", "user-2", "user-3", "user-4");
const reasonArb = fc.constantFrom("timeout", "error", "needs_human_decision");

const controlArb: fc.Arbitrary<HumanAgentControl> = fc.record({
  userId: userIdArb,
  agentId: agentIdArb,
  isPrimary: fc.boolean(),
});

const controlListArb = fc.array(controlArb, { minLength: 0, maxLength: 10 });

// ── Property 18 ─────────────────────────────────────────────────────────────

describe("Property 18: Blocked agent notifies primary controller", () => {
  it("when agent has a primary controller, notified=true and userId matches", () => {
    fc.assert(
      fc.property(agentIdArb, userIdArb, reasonArb, (agentId, userId, reason) => {
        const controls: HumanAgentControl[] = [
          { userId, agentId, isPrimary: true },
        ];

        const result = onAgentBlocked(controls, agentId, reason);

        expect(result.notified).toBe(true);
        expect(result.userId).toBe(userId);
      }),
      { numRuns: 500 },
    );
  });

  it("when agent has no primary controller, notified=false and userId is null", () => {
    fc.assert(
      fc.property(agentIdArb, reasonArb, controlListArb, (agentId, reason, controls) => {
        // Ensure no primary controller exists for this agent
        const filtered = controls
          .filter((c) => !(c.agentId === agentId && c.isPrimary))
          // Deduplicate by (userId, agentId)
          .filter(
            (c, i, arr) =>
              arr.findIndex((x) => x.userId === c.userId && x.agentId === c.agentId) === i,
          );

        const result = onAgentBlocked(filtered, agentId, reason);

        expect(result.notified).toBe(false);
        expect(result.userId).toBeNull();
      }),
      { numRuns: 500 },
    );
  });

  it("the notified userId always matches the primary controller's userId", () => {
    fc.assert(
      fc.property(agentIdArb, reasonArb, controlListArb, (agentId, reason, controls) => {
        // Deduplicate by (userId, agentId)
        const deduped = controls.filter(
          (c, i, arr) =>
            arr.findIndex((x) => x.userId === c.userId && x.agentId === c.agentId) === i,
        );

        const result = onAgentBlocked(deduped, agentId, reason);
        const primary = findPrimaryController(deduped, agentId);

        if (primary) {
          expect(result.notified).toBe(true);
          expect(result.userId).toBe(primary.userId);
        } else {
          expect(result.notified).toBe(false);
          expect(result.userId).toBeNull();
        }
      }),
      { numRuns: 1000 },
    );
  });
});
