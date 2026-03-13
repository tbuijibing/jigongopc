import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { CompanyMemberWithUser } from "@Jigongai/shared";

/**
 * Property 7: Frontend only displays user-type members
 *
 * When rendering, SidebarMembers filters out records where principalType is "agent",
 * showing only members with principalType === "user".
 *
 * Validates: Requirements 3.4
 */

/**
 * Pure filter logic extracted from SidebarMembers.tsx:
 *   const userMembers = (members ?? []).filter(m => m.principalType === "user");
 */
function filterUserMembers(
  members: CompanyMemberWithUser[] | undefined
): CompanyMemberWithUser[] {
  return (members ?? []).filter((m) => m.principalType === "user");
}

/** Arbitrary for a CompanyMemberWithUser with a specific principalType */
function arbMember(
  principalType: "user" | "agent"
): fc.Arbitrary<CompanyMemberWithUser> {
  return fc.record({
    id: fc.uuid(),
    companyId: fc.uuid(),
    principalType: fc.constant(principalType),
    principalId: fc.uuid(),
    status: fc.constant("active"),
    membershipRole: fc.oneof(
      fc.constant("owner"),
      fc.constant("member"),
      fc.constant(null)
    ),
    createdAt: fc
      .integer({
        min: new Date("2000-01-01").getTime(),
        max: new Date("2030-12-31").getTime(),
      })
      .map((ts) => new Date(ts).toISOString()),
    displayName: fc.oneof(fc.constant(null), fc.string({ minLength: 1 })),
    email: fc.oneof(fc.constant(null), fc.string({ minLength: 1 })),
    image: fc.oneof(fc.constant(null), fc.string({ minLength: 1 })),
  });
}

/** Arbitrary for a mixed array of user and agent members */
const arbMixedMembers: fc.Arbitrary<CompanyMemberWithUser[]> = fc.array(
  fc.oneof(arbMember("user"), arbMember("agent"))
);

describe("Frontend user-type member filter (Property 7)", () => {
  it("all returned members have principalType === 'user'", () => {
    fc.assert(
      fc.property(arbMixedMembers, (members) => {
        const result = filterUserMembers(members);
        for (const m of result) {
          expect(m.principalType).toBe("user");
        }
      }),
      { numRuns: 300 }
    );
  });

  it("no returned members have principalType === 'agent'", () => {
    fc.assert(
      fc.property(arbMixedMembers, (members) => {
        const result = filterUserMembers(members);
        for (const m of result) {
          expect(m.principalType).not.toBe("agent");
        }
      }),
      { numRuns: 300 }
    );
  });

  it("count of returned members equals count of user-type members in input", () => {
    fc.assert(
      fc.property(arbMixedMembers, (members) => {
        const result = filterUserMembers(members);
        const expectedCount = members.filter(
          (m) => m.principalType === "user"
        ).length;
        expect(result.length).toBe(expectedCount);
      }),
      { numRuns: 300 }
    );
  });

  it("returns empty array when input is undefined", () => {
    const result = filterUserMembers(undefined);
    expect(result).toEqual([]);
  });

  it("returns empty array when all members are agents", () => {
    fc.assert(
      fc.property(fc.array(arbMember("agent")), (members) => {
        const result = filterUserMembers(members);
        expect(result.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it("returns all members when all are users", () => {
    fc.assert(
      fc.property(fc.array(arbMember("user")), (members) => {
        const result = filterUserMembers(members);
        expect(result.length).toBe(members.length);
      }),
      { numRuns: 100 }
    );
  });
});
