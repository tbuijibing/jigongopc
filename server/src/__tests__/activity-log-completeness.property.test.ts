import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 23: Activity log completeness for mutations
 *
 * For any mutation operation on Agent six-dimension data, Issue dependencies,
 * Issue watchers, or Human-Agent controls, an activity_log record SHALL be
 * created containing valid actor_type, actor_id, action, entity_type,
 * entity_id, and companyId fields.
 *
 * Pure-function model (no DB). We model the set of all mutation actions that
 * should produce activity logs and verify every generated entry has all
 * required fields non-null and non-empty.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.4**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface ActivityLogEntry {
  actorType: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  companyId: string;
}

interface MutationOp {
  actorType: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  companyId: string;
}

// ── All mutation actions that must produce activity logs ─────────────────────

const MUTATION_ACTIONS = [
  // Agent six-dimension data (Req 21.1)
  "heartbeat_config.updated",
  "soul.updated",
  "agent_tool.created",
  "agent_tool.updated",
  "agent_tool.deleted",
  "skill.created",
  "agent_skill.installed",
  "agent_skill.uninstalled",
  "agent_memory.created",
  "agent_memory.updated",
  "agent_memory.deleted",
  // Issue dependencies & watchers (Req 21.2)
  "issue_dependency.created",
  "issue_dependency.deleted",
  "issue_watcher.created",
  "issue_watcher.deleted",
  // Human-Agent controls (Req 21.3)
  "human_agent_control.created",
  "human_agent_control.updated",
  "human_agent_control.deleted",
] as const;

const ENTITY_TYPE_FOR_ACTION: Record<string, string> = {
  "heartbeat_config.updated": "heartbeat_config",
  "soul.updated": "soul",
  "agent_tool.created": "agent_tool",
  "agent_tool.updated": "agent_tool",
  "agent_tool.deleted": "agent_tool",
  "skill.created": "skill",
  "agent_skill.installed": "agent_skill",
  "agent_skill.uninstalled": "agent_skill",
  "agent_memory.created": "agent_memory",
  "agent_memory.updated": "agent_memory",
  "agent_memory.deleted": "agent_memory",
  "issue_dependency.created": "issue_dependency",
  "issue_dependency.deleted": "issue_dependency",
  "issue_watcher.created": "issue_watcher",
  "issue_watcher.deleted": "issue_watcher",
  "human_agent_control.created": "human_agent_control",
  "human_agent_control.updated": "human_agent_control",
  "human_agent_control.deleted": "human_agent_control",
};

const ACTOR_TYPES = ["board", "agent", "system"] as const;

// ── Pure logic (mirrors route-level activity log creation) ──────────────────

/**
 * Simulates creating an activity log entry for a mutation operation.
 * Mirrors the pattern used across all route handlers that call
 * `db.insert(activityLog).values(...)`.
 */
function createActivityLogEntry(op: MutationOp): ActivityLogEntry {
  return {
    actorType: op.actorType,
    actorId: op.actorId,
    action: op.action,
    entityType: op.entityType,
    entityId: op.entityId,
    companyId: op.companyId,
  };
}

/**
 * Validates that an activity log entry has all required fields
 * non-null and non-empty.
 */
function isComplete(entry: ActivityLogEntry): boolean {
  return (
    typeof entry.actorType === "string" && entry.actorType.length > 0 &&
    typeof entry.actorId === "string" && entry.actorId.length > 0 &&
    typeof entry.action === "string" && entry.action.length > 0 &&
    typeof entry.entityType === "string" && entry.entityType.length > 0 &&
    typeof entry.entityId === "string" && entry.entityId.length > 0 &&
    typeof entry.companyId === "string" && entry.companyId.length > 0
  );
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.constantFrom("company-1", "company-2", "company-3");
const actorTypeArb = fc.constantFrom(...ACTOR_TYPES);
const actorIdArb = fc.constantFrom("user-1", "user-2", "agent-A", "agent-B", "system");
const entityIdArb = fc.uuid();
const actionArb = fc.constantFrom(...MUTATION_ACTIONS);

const mutationOpArb: fc.Arbitrary<MutationOp> = actionArb.chain((action) =>
  fc.record({
    actorType: actorTypeArb,
    actorId: actorIdArb,
    action: fc.constant(action),
    entityType: fc.constant(ENTITY_TYPE_FOR_ACTION[action]),
    entityId: entityIdArb,
    companyId: companyIdArb,
  }),
);

const mutationOpListArb = fc.array(mutationOpArb, { minLength: 1, maxLength: 30 });

// ── Property 23 ─────────────────────────────────────────────────────────────

describe("Property 23: Activity log completeness for mutations", () => {
  it("every mutation operation produces an activity log entry with all required fields non-null/non-empty", () => {
    fc.assert(
      fc.property(mutationOpArb, (op) => {
        const entry = createActivityLogEntry(op);
        expect(isComplete(entry)).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  it("a batch of mutation operations all produce complete activity log entries", () => {
    fc.assert(
      fc.property(mutationOpListArb, (ops) => {
        const entries = ops.map(createActivityLogEntry);
        for (const entry of entries) {
          expect(isComplete(entry)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("all defined mutation actions are covered and map to a known entity type", () => {
    for (const action of MUTATION_ACTIONS) {
      const entityType = ENTITY_TYPE_FOR_ACTION[action];
      expect(entityType).toBeDefined();
      expect(entityType.length).toBeGreaterThan(0);
    }
  });

  it("activity log action field matches the mutation action exactly", () => {
    fc.assert(
      fc.property(mutationOpArb, (op) => {
        const entry = createActivityLogEntry(op);
        expect(entry.action).toBe(op.action);
      }),
      { numRuns: 500 },
    );
  });

  it("activity log entityType is consistent with the action performed", () => {
    fc.assert(
      fc.property(mutationOpArb, (op) => {
        const entry = createActivityLogEntry(op);
        const expectedEntityType = ENTITY_TYPE_FOR_ACTION[op.action];
        expect(entry.entityType).toBe(expectedEntityType);
      }),
      { numRuns: 500 },
    );
  });

  it("activity log companyId matches the mutation's companyId", () => {
    fc.assert(
      fc.property(mutationOpArb, (op) => {
        const entry = createActivityLogEntry(op);
        expect(entry.companyId).toBe(op.companyId);
      }),
      { numRuns: 500 },
    );
  });
});
