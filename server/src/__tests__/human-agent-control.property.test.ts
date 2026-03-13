import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 16: Single primary controller per Agent
 *
 * For any Agent, at most one Human_Agent_Control record SHALL have
 * isPrimary=true at any given time. Setting a new primary controller
 * SHALL ensure no other primary exists for that Agent.
 *
 * Modelled as pure functions (no DB needed) following the pattern in
 * parent-child-completion.property.test.ts and issue-watcher.property.test.ts.
 *
 * **Validates: Requirements 14.3**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface HumanAgentControl {
  id: string;
  companyId: string;
  userId: string;
  agentId: string;
  isPrimary: boolean;
}

type CreateOp = {
  type: "create";
  companyId: string;
  userId: string;
  agentId: string;
  isPrimary: boolean;
};

type UpdateOp = {
  type: "update";
  controlId: string;
  isPrimary: boolean;
};

type Op = CreateOp | UpdateOp;

// ── Pure logic (mirrors HumanAgentControlService) ───────────────────────────

/**
 * Pure-function equivalent of ensureSinglePrimary + createControl/updateControl
 * in human-agent-controls.ts.
 *
 * Applies a sequence of create/update operations to a controls list,
 * enforcing the single-primary invariant: when isPrimary is set to true,
 * any existing primary for that agent is demoted to false.
 */
function applyOps(ops: Op[]): HumanAgentControl[] {
  const controls: HumanAgentControl[] = [];
  let nextId = 1;

  for (const op of ops) {
    if (op.type === "create") {
      // Skip duplicate (userId, agentId) — mirrors unique constraint
      const dup = controls.find(
        (c) => c.userId === op.userId && c.agentId === op.agentId,
      );
      if (dup) continue;

      // Demote existing primary for this agent if new one is primary
      if (op.isPrimary) {
        for (const c of controls) {
          if (c.agentId === op.agentId && c.isPrimary) {
            c.isPrimary = false;
          }
        }
      }

      controls.push({
        id: `ctrl-${nextId++}`,
        companyId: op.companyId,
        userId: op.userId,
        agentId: op.agentId,
        isPrimary: op.isPrimary,
      });
    } else {
      // update
      const existing = controls.find((c) => c.id === op.controlId);
      if (!existing) continue;

      if (op.isPrimary) {
        for (const c of controls) {
          if (c.agentId === existing.agentId && c.isPrimary && c.id !== op.controlId) {
            c.isPrimary = false;
          }
        }
      }

      existing.isPrimary = op.isPrimary;
    }
  }

  return controls;
}

/**
 * Count how many primary controllers exist for a given agent.
 */
function countPrimaries(controls: HumanAgentControl[], agentId: string): number {
  return controls.filter((c) => c.agentId === agentId && c.isPrimary).length;
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.constantFrom("company-1", "company-2");
const agentIdArb = fc.constantFrom("agent-A", "agent-B", "agent-C");
const userIdArb = fc.constantFrom("user-1", "user-2", "user-3", "user-4", "user-5");

const createOpArb: fc.Arbitrary<CreateOp> = fc.record({
  type: fc.constant("create" as const),
  companyId: companyIdArb,
  userId: userIdArb,
  agentId: agentIdArb,
  isPrimary: fc.boolean(),
});

/**
 * Generate an update op that references a control ID from the range of
 * possible IDs (ctrl-1 through ctrl-N). Some may not exist — the pure
 * logic skips missing IDs, mirroring the service's notFound behavior.
 */
const updateOpArb: fc.Arbitrary<UpdateOp> = fc.record({
  type: fc.constant("update" as const),
  controlId: fc.integer({ min: 1, max: 10 }).map((n) => `ctrl-${n}`),
  isPrimary: fc.boolean(),
});

const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 3, arbitrary: createOpArb },
  { weight: 2, arbitrary: updateOpArb },
);

const opListArb = fc.array(opArb, { minLength: 1, max: 20 });

// ── Property 16: Single primary controller per Agent ────────────────────────

describe("Property 16: Single primary controller per Agent — at most one isPrimary=true per agent", () => {
  it("after any sequence of create/update ops, each agent has at most one primary controller", () => {
    fc.assert(
      fc.property(opListArb, (ops) => {
        const controls = applyOps(ops);

        // Collect all distinct agent IDs
        const agentIds = [...new Set(controls.map((c) => c.agentId))];

        for (const agentId of agentIds) {
          expect(countPrimaries(controls, agentId)).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("setting isPrimary=true on a new control demotes the existing primary for that agent", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        agentIdArb,
        fc.tuple(userIdArb, userIdArb).filter(([a, b]) => a !== b),
        (companyId, agentId, [user1, user2]) => {
          const ops: Op[] = [
            { type: "create", companyId, userId: user1, agentId, isPrimary: true },
            { type: "create", companyId, userId: user2, agentId, isPrimary: true },
          ];

          const controls = applyOps(ops);

          // user2 should be the primary now
          const ctrl1 = controls.find((c) => c.userId === user1)!;
          const ctrl2 = controls.find((c) => c.userId === user2)!;

          expect(ctrl1.isPrimary).toBe(false);
          expect(ctrl2.isPrimary).toBe(true);
          expect(countPrimaries(controls, agentId)).toBe(1);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("creating a non-primary control does not affect existing primary", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        agentIdArb,
        fc.tuple(userIdArb, userIdArb).filter(([a, b]) => a !== b),
        (companyId, agentId, [user1, user2]) => {
          const ops: Op[] = [
            { type: "create", companyId, userId: user1, agentId, isPrimary: true },
            { type: "create", companyId, userId: user2, agentId, isPrimary: false },
          ];

          const controls = applyOps(ops);

          const ctrl1 = controls.find((c) => c.userId === user1)!;
          const ctrl2 = controls.find((c) => c.userId === user2)!;

          expect(ctrl1.isPrimary).toBe(true);
          expect(ctrl2.isPrimary).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("updating a control to isPrimary=true demotes the existing primary", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        agentIdArb,
        fc.tuple(userIdArb, userIdArb).filter(([a, b]) => a !== b),
        (companyId, agentId, [user1, user2]) => {
          // Create user1 as primary, user2 as non-primary, then promote user2
          const ops: Op[] = [
            { type: "create", companyId, userId: user1, agentId, isPrimary: true },
            { type: "create", companyId, userId: user2, agentId, isPrimary: false },
            { type: "update", controlId: "ctrl-2", isPrimary: true },
          ];

          const controls = applyOps(ops);

          const ctrl1 = controls.find((c) => c.userId === user1)!;
          const ctrl2 = controls.find((c) => c.userId === user2)!;

          expect(ctrl1.isPrimary).toBe(false);
          expect(ctrl2.isPrimary).toBe(true);
          expect(countPrimaries(controls, agentId)).toBe(1);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("an agent with no primary controllers has zero primaries", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        agentIdArb,
        fc.array(userIdArb, { minLength: 1, maxLength: 5 }),
        (companyId, agentId, users) => {
          const uniqueUsers = [...new Set(users)];
          const ops: Op[] = uniqueUsers.map((userId) => ({
            type: "create" as const,
            companyId,
            userId,
            agentId,
            isPrimary: false,
          }));

          const controls = applyOps(ops);
          expect(countPrimaries(controls, agentId)).toBe(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("different agents can each have their own primary controller independently", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        fc.tuple(agentIdArb, agentIdArb).filter(([a, b]) => a !== b),
        fc.tuple(userIdArb, userIdArb).filter(([a, b]) => a !== b),
        (companyId, [agent1, agent2], [user1, user2]) => {
          const ops: Op[] = [
            { type: "create", companyId, userId: user1, agentId: agent1, isPrimary: true },
            { type: "create", companyId, userId: user2, agentId: agent2, isPrimary: true },
          ];

          const controls = applyOps(ops);

          expect(countPrimaries(controls, agent1)).toBe(1);
          expect(countPrimaries(controls, agent2)).toBe(1);

          const ctrl1 = controls.find((c) => c.agentId === agent1 && c.isPrimary)!;
          const ctrl2 = controls.find((c) => c.agentId === agent2 && c.isPrimary)!;

          expect(ctrl1.userId).toBe(user1);
          expect(ctrl2.userId).toBe(user2);
        },
      ),
      { numRuns: 500 },
    );
  });
});
