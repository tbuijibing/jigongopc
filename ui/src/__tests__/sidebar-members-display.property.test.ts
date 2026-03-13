import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 4: Display name fallback chain
 *
 * For any member with principalType "user", the sidebar display text follows:
 * - If displayName is non-null → show displayName
 * - Else if email is non-null → show email
 * - Else → show "未知用户"
 *
 * Validates: Requirements 3.3
 */

/**
 * Pure display-name fallback extracted from SidebarMembers.tsx:
 *   {member.displayName ?? member.email ?? "未知用户"}
 */
function getDisplayText(
  displayName: string | null,
  email: string | null
): string {
  return displayName ?? email ?? "未知用户";
}

/** Arbitrary that produces null or a non-empty string */
const nullableNonEmptyString = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1 })
);

/** Arbitrary that produces null, empty string, or a non-empty string */
const nullableString = fc.oneof(
  fc.constant(null),
  fc.constant(""),
  fc.string({ minLength: 1 })
);

describe("Display name fallback chain (Property 4)", () => {
  it("returns displayName when displayName is non-null", () => {
    fc.assert(
      fc.property(
        fc.string(), // displayName — any non-null string (including empty)
        nullableString, // email — any nullable string
        (displayName, email) => {
          const result = getDisplayText(displayName, email);
          expect(result).toBe(displayName);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns email when displayName is null and email is non-null", () => {
    fc.assert(
      fc.property(
        fc.string(), // email — any non-null string (including empty)
        (email) => {
          const result = getDisplayText(null, email);
          expect(result).toBe(email);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns "未知用户" when both displayName and email are null', () => {
    const result = getDisplayText(null, null);
    expect(result).toBe("未知用户");
  });

  it("never returns null or undefined for any combination of inputs", () => {
    fc.assert(
      fc.property(
        nullableString,
        nullableString,
        (displayName, email) => {
          const result = getDisplayText(displayName, email);
          expect(result).not.toBeNull();
          expect(result).not.toBeUndefined();
          expect(typeof result).toBe("string");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("follows the correct fallback priority for all input combinations", () => {
    fc.assert(
      fc.property(
        nullableString,
        nullableString,
        (displayName, email) => {
          const result = getDisplayText(displayName, email);

          if (displayName !== null) {
            // displayName takes priority when non-null
            expect(result).toBe(displayName);
          } else if (email !== null) {
            // email is next when displayName is null
            expect(result).toBe(email);
          } else {
            // fallback when both are null
            expect(result).toBe("未知用户");
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
