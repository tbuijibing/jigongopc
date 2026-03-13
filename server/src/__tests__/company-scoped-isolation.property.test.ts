import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 2: Company-scoped isolation
 *
 * For any API operation on a company-scoped Agent six-dimension entity
 * (Heartbeat config, Soul, Tool, Skill, Memory, Capabilities), if the
 * target agent does not belong to the specified companyId in the request
 * path, the operation SHALL be rejected with an appropriate error (404).
 *
 * The isolation is enforced at two layers:
 *   1. Route layer: assertCompanyAccess(req, companyId) — checks actor can
 *      access the company. For agent actors, req.actor.companyId must match.
 *   2. Service layer: ensureAgentBelongsToCompany(companyId, agentId) —
 *      verifies agent.companyId === companyId via DB query.
 *
 * This test models both layers as pure functions and verifies the isolation
 * property holds across all six dimensions and all HTTP methods.
 *
 * **Validates: Requirements 1.6, 2.5, 3.6, 4.9, 5.7, 6.5**
 */

// ── Types ───────────────────────────────────────────────────────────────────

type ActorType = "board" | "agent" | "none";

interface BoardActor {
  type: "board";
  source: "local_implicit" | "session";
  isInstanceAdmin: boolean;
  companyIds: string[];
  userId: string;
}

interface AgentActor {
  type: "agent";
  companyId: string;
  agentId: string;
}

interface NoneActor {
  type: "none";
}

type Actor = BoardActor | AgentActor | NoneActor;

interface AgentRow {
  id: string;
  companyId: string;
}

type Dimension =
  | "heartbeat-config"
  | "soul"
  | "tools"
  | "skills"
  | "memory"
  | "capabilities";

type HttpMethod = "GET" | "PUT" | "POST" | "DELETE";

interface DimensionEndpoint {
  dimension: Dimension;
  method: HttpMethod;
  /** Whether this endpoint requires the agent to exist (mutation endpoints) */
  requiresAgentLookup: boolean;
}

// ── All six-dimension endpoints ─────────────────────────────────────────────

const ALL_ENDPOINTS: DimensionEndpoint[] = [
  // Heartbeat config
  { dimension: "heartbeat-config", method: "GET", requiresAgentLookup: true },
  { dimension: "heartbeat-config", method: "PUT", requiresAgentLookup: true },
  // Soul
  { dimension: "soul", method: "GET", requiresAgentLookup: true },
  { dimension: "soul", method: "PUT", requiresAgentLookup: true },
  // Tools
  { dimension: "tools", method: "GET", requiresAgentLookup: true },
  { dimension: "tools", method: "POST", requiresAgentLookup: true },
  { dimension: "tools", method: "PUT", requiresAgentLookup: true },
  { dimension: "tools", method: "DELETE", requiresAgentLookup: true },
  // Skills (agent-level)
  { dimension: "skills", method: "GET", requiresAgentLookup: true },
  { dimension: "skills", method: "POST", requiresAgentLookup: true },
  { dimension: "skills", method: "DELETE", requiresAgentLookup: true },
  // Memory
  { dimension: "memory", method: "GET", requiresAgentLookup: true },
  { dimension: "memory", method: "POST", requiresAgentLookup: true },
  { dimension: "memory", method: "PUT", requiresAgentLookup: true },
  { dimension: "memory", method: "DELETE", requiresAgentLookup: true },
  // Capabilities (company-level, no agent lookup needed)
  { dimension: "capabilities", method: "GET", requiresAgentLookup: false },
];

// ── Pure isolation logic (mirrors route + service layer) ────────────────────

type IsolationResult =
  | { allowed: true }
  | { rejected: true; status: 401 | 403 | 404; reason: string };

/**
 * Route-layer check: assertCompanyAccess(req, companyId)
 *
 * Mirrors server/src/routes/authz.ts:
 *   - none actor → 401
 *   - agent actor with mismatched companyId → 403
 *   - board actor (non-local, non-admin) without companyId in allowedList → 403
 *   - otherwise → allowed
 */
function checkCompanyAccess(actor: Actor, requestCompanyId: string): IsolationResult {
  if (actor.type === "none") {
    return { rejected: true, status: 401, reason: "Unauthenticated" };
  }
  if (actor.type === "agent" && actor.companyId !== requestCompanyId) {
    return { rejected: true, status: 403, reason: "Agent key cannot access another company" };
  }
  if (actor.type === "board") {
    if (actor.source === "local_implicit" || actor.isInstanceAdmin) {
      return { allowed: true };
    }
    if (!actor.companyIds.includes(requestCompanyId)) {
      return { rejected: true, status: 403, reason: "User does not have access to this company" };
    }
  }
  return { allowed: true };
}

/**
 * Service-layer check: ensureAgentBelongsToCompany(companyId, agentId)
 *
 * Mirrors the pattern used in all six-dimension services:
 *   - Query agents WHERE id = agentId AND companyId = companyId
 *   - If no row → 404 "Agent not found"
 */
function checkAgentBelongsToCompany(
  agent: AgentRow | null,
  requestCompanyId: string,
): IsolationResult {
  if (!agent || agent.companyId !== requestCompanyId) {
    return { rejected: true, status: 404, reason: "Agent not found" };
  }
  return { allowed: true };
}

/**
 * Combined isolation check for a six-dimension endpoint.
 *
 * 1. Check actor has access to the company (route layer)
 * 2. For agent-scoped endpoints, check agent belongs to company (service layer)
 */
function checkIsolation(
  actor: Actor,
  requestCompanyId: string,
  agent: AgentRow | null,
  endpoint: DimensionEndpoint,
): IsolationResult {
  // Step 1: Route-layer company access
  const accessResult = checkCompanyAccess(actor, requestCompanyId);
  if ("rejected" in accessResult) return accessResult;

  // Step 2: Service-layer agent-company binding (for agent-scoped endpoints)
  if (endpoint.requiresAgentLookup) {
    const agentResult = checkAgentBelongsToCompany(agent, requestCompanyId);
    if ("rejected" in agentResult) return agentResult;
  }

  return { allowed: true };
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.uuid();

const boardActorArb: fc.Arbitrary<BoardActor> = fc.record({
  type: fc.constant("board" as const),
  source: fc.constantFrom("local_implicit" as const, "session" as const),
  isInstanceAdmin: fc.boolean(),
  companyIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
  userId: fc.uuid(),
});

const agentActorArb: fc.Arbitrary<AgentActor> = fc.record({
  type: fc.constant("agent" as const),
  companyId: fc.uuid(),
  agentId: fc.uuid(),
});

const noneActorArb: fc.Arbitrary<NoneActor> = fc.constant({ type: "none" as const });

const actorArb: fc.Arbitrary<Actor> = fc.oneof(boardActorArb, agentActorArb, noneActorArb);

const agentRowArb: fc.Arbitrary<AgentRow> = fc.record({
  id: fc.uuid(),
  companyId: fc.uuid(),
});

const endpointArb: fc.Arbitrary<DimensionEndpoint> = fc.constantFrom(...ALL_ENDPOINTS);

// ── Property tests ──────────────────────────────────────────────────────────

describe("Property 2: Company-scoped isolation — Agent six-dimension APIs", () => {
  it("agent actor accessing a different company is always rejected with 403", () => {
    fc.assert(
      fc.property(
        agentActorArb,
        companyIdArb,
        agentRowArb,
        endpointArb,
        (actor, requestCompanyId, agent, endpoint) => {
          // Ensure the actor's company differs from the request path company
          fc.pre(actor.companyId !== requestCompanyId);

          const result = checkIsolation(actor, requestCompanyId, agent, endpoint);
          expect("rejected" in result).toBe(true);
          if ("rejected" in result) {
            expect(result.status).toBe(403);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("agent belonging to a different company than the request path is rejected with 404", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        agentRowArb,
        endpointArb.filter((e) => e.requiresAgentLookup),
        (requestCompanyId, agent, endpoint) => {
          // Agent exists but belongs to a different company
          fc.pre(agent.companyId !== requestCompanyId);

          // Use a board actor with full access so route-layer passes
          const boardActor: BoardActor = {
            type: "board",
            source: "local_implicit",
            isInstanceAdmin: false,
            companyIds: [],
            userId: "board-user",
          };

          const result = checkIsolation(boardActor, requestCompanyId, agent, endpoint);
          expect("rejected" in result).toBe(true);
          if ("rejected" in result) {
            expect(result.status).toBe(404);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("unauthenticated actor is always rejected with 401 regardless of dimension", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        agentRowArb,
        endpointArb,
        (requestCompanyId, agent, endpoint) => {
          const noneActor: NoneActor = { type: "none" };
          const result = checkIsolation(noneActor, requestCompanyId, agent, endpoint);
          expect("rejected" in result).toBe(true);
          if ("rejected" in result) {
            expect(result.status).toBe(401);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("board user without company in allowedList is rejected with 403", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        agentRowArb,
        endpointArb,
        (requestCompanyId, allowedCompanies, agent, endpoint) => {
          // Ensure the request company is NOT in the allowed list
          fc.pre(!allowedCompanies.includes(requestCompanyId));

          const boardActor: BoardActor = {
            type: "board",
            source: "session",
            isInstanceAdmin: false,
            companyIds: allowedCompanies,
            userId: "some-user",
          };

          const result = checkIsolation(boardActor, requestCompanyId, agent, endpoint);
          expect("rejected" in result).toBe(true);
          if ("rejected" in result) {
            expect(result.status).toBe(403);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("same-company agent actor with matching agent is allowed for all dimensions", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        fc.uuid(),
        endpointArb,
        (companyId, agentId, endpoint) => {
          // Actor and agent both belong to the same company
          const actor: AgentActor = {
            type: "agent",
            companyId,
            agentId,
          };
          const agent: AgentRow = { id: agentId, companyId };

          const result = checkIsolation(actor, companyId, agent, endpoint);
          expect("allowed" in result).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("non-existent agent (null) is rejected with 404 for agent-scoped endpoints", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        endpointArb.filter((e) => e.requiresAgentLookup),
        (companyId, endpoint) => {
          // Board actor with full access, but agent doesn't exist
          const boardActor: BoardActor = {
            type: "board",
            source: "local_implicit",
            isInstanceAdmin: false,
            companyIds: [],
            userId: "board-user",
          };

          const result = checkIsolation(boardActor, companyId, null, endpoint);
          expect("rejected" in result).toBe(true);
          if ("rejected" in result) {
            expect(result.status).toBe(404);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("isolation is enforced uniformly across all six dimensions", () => {
    fc.assert(
      fc.property(
        agentActorArb,
        companyIdArb,
        agentRowArb,
        (actor, requestCompanyId, agent) => {
          // Cross-company agent actor
          fc.pre(actor.companyId !== requestCompanyId);

          // Every endpoint must reject with the same status
          const results = ALL_ENDPOINTS.map((ep) =>
            checkIsolation(actor, requestCompanyId, agent, ep),
          );

          for (const result of results) {
            expect("rejected" in result).toBe(true);
            if ("rejected" in result) {
              expect(result.status).toBe(403);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("local_implicit board and instance admin always pass route-layer check", () => {
    fc.assert(
      fc.property(
        companyIdArb,
        fc.uuid(),
        fc.boolean(),
        endpointArb,
        (companyId, agentId, isAdmin, endpoint) => {
          const agent: AgentRow = { id: agentId, companyId };

          // local_implicit board
          const localActor: BoardActor = {
            type: "board",
            source: "local_implicit",
            isInstanceAdmin: false,
            companyIds: [], // empty — doesn't matter for local_implicit
            userId: "local-user",
          };
          const localResult = checkIsolation(localActor, companyId, agent, endpoint);
          expect("allowed" in localResult).toBe(true);

          // instance admin board
          const adminActor: BoardActor = {
            type: "board",
            source: "session",
            isInstanceAdmin: true,
            companyIds: [], // empty — doesn't matter for admin
            userId: "admin-user",
          };
          const adminResult = checkIsolation(adminActor, companyId, agent, endpoint);
          expect("allowed" in adminResult).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
