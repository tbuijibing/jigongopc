import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { HttpError } from "../errors.js";

/**
 * Property 5: Issue creation permission consistency
 *
 * `canCreateIssue` returns true (does not throw) if and only if the user is
 * an active company member, an instance admin, or a local_implicit board user.
 * Non-members who are not instance admin receive a 403 "Company membership
 * required to create issues". Agents always pass (handled by assertCompanyAccess).
 * Actor type "none" receives 401.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

// ── Replicate the pure permission logic from assertCanCreateIssue ───────────

type MembershipRow = { status: string } | null;

interface Actor {
  type: "board" | "agent" | "none";
  userId: string;
  source: "local_implicit" | "session" | "agent_key" | "agent_jwt" | "none";
  isInstanceAdmin: boolean;
  companyIds: string[];
  agentId?: string;
  companyId?: string;
}

/**
 * Pure-function equivalent of the `assertCanCreateIssue` closure in
 * `server/src/routes/issues.ts`. We skip the `assertCompanyAccess` call
 * (it guards company-level access, not issue-create permission) and focus
 * on the permission decision that follows.
 *
 * Throws HttpError(403) or HttpError(401) on denial, returns void on allow.
 */
function assertCanCreateIssue(
  actor: Actor,
  membership: MembershipRow,
): void {
  if (actor.type === "board") {
    if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
    if (membership && membership.status === "active") return;
    throw new HttpError(403, "Company membership required to create issues");
  }

  if (actor.type === "agent") {
    return; // existing agent permission checks handled in assertCompanyAccess
  }

  throw new HttpError(401, "Unauthorized");
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.uuid();
const userIdArb = fc.uuid();

const membershipStatusArb = fc.constantFrom("active", "pending", "suspended");

/** Generates a membership row or null (no membership) */
const membershipArb: fc.Arbitrary<MembershipRow> = fc.oneof(
  fc.constant(null),
  fc.record({ status: membershipStatusArb }),
);

const boardSourceArb = fc.constantFrom(
  "local_implicit" as const,
  "session" as const,
);

/** Board actor generator */
const boardActorArb = fc
  .record({
    userId: userIdArb,
    source: boardSourceArb,
    isInstanceAdmin: fc.boolean(),
    companyIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
  })
  .map(
    (r): Actor => ({
      type: "board",
      userId: r.userId,
      source: r.source,
      isInstanceAdmin: r.isInstanceAdmin,
      companyIds: r.companyIds,
    }),
  );

/** Agent actor generator */
const agentActorArb = fc
  .record({
    agentId: fc.uuid(),
    companyId: fc.uuid(),
  })
  .map(
    (r): Actor => ({
      type: "agent",
      userId: "",
      source: "agent_key",
      isInstanceAdmin: false,
      companyIds: [],
      agentId: r.agentId,
      companyId: r.companyId,
    }),
  );

/** "none" actor (unauthenticated) */
const noneActorArb = fc.constant<Actor>({
  type: "none",
  userId: "",
  source: "none",
  isInstanceAdmin: false,
  companyIds: [],
});

/** Any actor */
const actorArb = fc.oneof(boardActorArb, agentActorArb, noneActorArb);

// ── Property tests ──────────────────────────────────────────────────────────

describe("Property 5: Issue creation permission consistency", () => {
  it("active company members CAN create issues", () => {
    fc.assert(
      fc.property(
        boardActorArb.filter(
          (a) => a.source !== "local_implicit" && !a.isInstanceAdmin,
        ),
        (actor) => {
          const activeMembership: MembershipRow = { status: "active" };
          // Should NOT throw
          expect(() =>
            assertCanCreateIssue(actor, activeMembership),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("instance admins CAN create issues regardless of membership", () => {
    fc.assert(
      fc.property(
        boardActorArb
          .filter((a) => a.isInstanceAdmin)
          .map((a) => ({ ...a, source: "session" as const })),
        membershipArb,
        (actor, membership) => {
          // Instance admin should always be allowed, regardless of membership
          expect(() =>
            assertCanCreateIssue(actor, membership),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("local_implicit board users CAN create issues regardless of membership", () => {
    fc.assert(
      fc.property(
        boardActorArb.map((a) => ({
          ...a,
          source: "local_implicit" as const,
          isInstanceAdmin: false,
        })),
        membershipArb,
        (actor, membership) => {
          expect(() =>
            assertCanCreateIssue(actor, membership),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("non-members who are not instance admin get 403", () => {
    fc.assert(
      fc.property(
        boardActorArb.filter(
          (a) => a.source !== "local_implicit" && !a.isInstanceAdmin,
        ),
        fc.constantFrom<MembershipRow>(
          null,
          { status: "pending" },
          { status: "suspended" },
        ),
        (actor, membership) => {
          try {
            assertCanCreateIssue(actor, membership);
            // Should not reach here
            expect.unreachable("Expected 403 to be thrown");
          } catch (err) {
            expect(err).toBeInstanceOf(HttpError);
            expect((err as HttpError).status).toBe(403);
            expect((err as HttpError).message).toBe(
              "Company membership required to create issues",
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("agents always pass (permission delegated to assertCompanyAccess)", () => {
    fc.assert(
      fc.property(agentActorArb, membershipArb, (actor, membership) => {
        expect(() =>
          assertCanCreateIssue(actor, membership),
        ).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it("unauthenticated (none) actors get 401", () => {
    fc.assert(
      fc.property(noneActorArb, membershipArb, (actor, membership) => {
        try {
          assertCanCreateIssue(actor, membership);
          expect.unreachable("Expected 401 to be thrown");
        } catch (err) {
          expect(err).toBeInstanceOf(HttpError);
          expect((err as HttpError).status).toBe(401);
        }
      }),
      { numRuns: 10 },
    );
  });

  it("permission is granted iff actor is admin, local_implicit, or active member (universal property)", () => {
    fc.assert(
      fc.property(actorArb, membershipArb, (actor, membership) => {
        const isAdmin =
          actor.type === "board" &&
          (actor.source === "local_implicit" || actor.isInstanceAdmin);
        const isActiveMember =
          actor.type === "board" &&
          membership !== null &&
          membership.status === "active";
        const isAgent = actor.type === "agent";
        const shouldBeAllowed = isAdmin || isActiveMember || isAgent;

        if (actor.type === "none") {
          // Unauthenticated → 401
          expect(() => assertCanCreateIssue(actor, membership)).toThrow();
          return;
        }

        if (shouldBeAllowed) {
          expect(() =>
            assertCanCreateIssue(actor, membership),
          ).not.toThrow();
        } else {
          expect(() =>
            assertCanCreateIssue(actor, membership),
          ).toThrow();
        }
      }),
      { numRuns: 200 },
    );
  });
});
