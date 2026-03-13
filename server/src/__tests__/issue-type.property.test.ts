import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ISSUE_TYPES } from "@jigongai/shared";

/**
 * Property 9: Issue type validation
 *
 * For any Issue creation, the issue_type field SHALL be one of the 8 valid
 * types (task, story, bug, epic, review, approval, document, milestone).
 * Invalid types SHALL be rejected.
 *
 * Property 10: Issue type filter correctness
 *
 * For any Issue list query with an issue_type filter, every returned Issue
 * SHALL have an issue_type matching the filter, and no Issue matching the
 * filter SHALL be omitted.
 *
 * Both properties are modelled as pure functions (no DB needed) following
 * the pattern in company-scoped-isolation.property.test.ts.
 *
 * **Validates: Requirements 8.1, 8.3, 8.4**
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface IssueCreateInput {
  title: string;
  issueType?: string;
}

type ValidationResult =
  | { accepted: true; issueType: string }
  | { rejected: true; reason: string };

interface IssueRow {
  id: string;
  issueType: string;
  title: string;
}

// ── Pure validation logic (mirrors IssueService.create) ─────────────────────

const VALID_ISSUE_TYPES: readonly string[] = ISSUE_TYPES;
const DEFAULT_ISSUE_TYPE = "task";

/**
 * Pure-function equivalent of the issue_type validation in
 * `server/src/services/issues.ts` create method.
 *
 * If issueType is provided and not in ISSUE_TYPES, reject with error.
 * If issueType is omitted, default to 'task'.
 */
function validateIssueType(input: IssueCreateInput): ValidationResult {
  const issueType = input.issueType ?? DEFAULT_ISSUE_TYPE;
  if (!VALID_ISSUE_TYPES.includes(issueType)) {
    return {
      rejected: true,
      reason: `Invalid issue type: ${issueType}. Must be one of: ${VALID_ISSUE_TYPES.join(", ")}`,
    };
  }
  return { accepted: true, issueType };
}

/**
 * Pure-function equivalent of the issue_type filter in
 * `server/src/services/issues.ts` list method.
 *
 * Given a list of issues and an optional issueType filter,
 * returns only issues whose issueType matches the filter.
 */
function filterIssuesByType(issues: IssueRow[], issueTypeFilter?: string): IssueRow[] {
  if (!issueTypeFilter) return issues;
  return issues.filter((issue) => issue.issueType === issueTypeFilter);
}

// ── Generators ──────────────────────────────────────────────────────────────

/** A valid issue type from the ISSUE_TYPES constant */
const validIssueTypeArb = fc.constantFrom(...ISSUE_TYPES);

/** An arbitrary string that is NOT a valid issue type */
const invalidIssueTypeArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => !VALID_ISSUE_TYPES.includes(s));

/** An issue row with a random valid type */
const issueRowArb: fc.Arbitrary<IssueRow> = fc.record({
  id: fc.uuid(),
  issueType: validIssueTypeArb,
  title: fc.string({ minLength: 1, maxLength: 50 }),
});

// ── Property 9: Issue type validation ───────────────────────────────────────

describe("Property 9: Issue type validation — invalid types rejected, valid types accepted", () => {
  it("all 8 valid issue types are accepted", () => {
    fc.assert(
      fc.property(validIssueTypeArb, fc.string({ minLength: 1 }), (issueType, title) => {
        const result = validateIssueType({ title, issueType });
        expect("accepted" in result).toBe(true);
        if ("accepted" in result) {
          expect(result.issueType).toBe(issueType);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("invalid issue types are rejected", () => {
    fc.assert(
      fc.property(invalidIssueTypeArb, fc.string({ minLength: 1 }), (issueType, title) => {
        const result = validateIssueType({ title, issueType });
        expect("rejected" in result).toBe(true);
        if ("rejected" in result) {
          expect(result.reason).toContain("Invalid issue type");
        }
      }),
      { numRuns: 300 },
    );
  });

  it("omitted issue type defaults to 'task'", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (title) => {
        const result = validateIssueType({ title });
        expect("accepted" in result).toBe(true);
        if ("accepted" in result) {
          expect(result.issueType).toBe("task");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("validation is a total function: every string is either accepted or rejected", () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), (issueType, title) => {
        const result = validateIssueType({ title, issueType });
        const isAccepted = "accepted" in result;
        const isRejected = "rejected" in result;
        // Exactly one of accepted or rejected
        expect(isAccepted !== isRejected).toBe(true);
        // Accepted iff in VALID_ISSUE_TYPES
        expect(isAccepted).toBe(VALID_ISSUE_TYPES.includes(issueType));
      }),
      { numRuns: 500 },
    );
  });
});

// ── Property 10: Issue type filter correctness ──────────────────────────────

describe("Property 10: Issue type filter correctness — filter results are complete and precise", () => {
  it("every returned issue matches the filter type", () => {
    fc.assert(
      fc.property(
        fc.array(issueRowArb, { minLength: 0, maxLength: 30 }),
        validIssueTypeArb,
        (issues, filterType) => {
          const filtered = filterIssuesByType(issues, filterType);
          for (const issue of filtered) {
            expect(issue.issueType).toBe(filterType);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("no matching issue is omitted from the result", () => {
    fc.assert(
      fc.property(
        fc.array(issueRowArb, { minLength: 0, maxLength: 30 }),
        validIssueTypeArb,
        (issues, filterType) => {
          const filtered = filterIssuesByType(issues, filterType);
          const expectedCount = issues.filter((i) => i.issueType === filterType).length;
          expect(filtered.length).toBe(expectedCount);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("filter result is exactly the subset with matching type (completeness + precision)", () => {
    fc.assert(
      fc.property(
        fc.array(issueRowArb, { minLength: 0, maxLength: 30 }),
        validIssueTypeArb,
        (issues, filterType) => {
          const filtered = filterIssuesByType(issues, filterType);
          const expected = issues.filter((i) => i.issueType === filterType);
          // Same length
          expect(filtered.length).toBe(expected.length);
          // Same ids in same order
          expect(filtered.map((i) => i.id)).toEqual(expected.map((i) => i.id));
        },
      ),
      { numRuns: 300 },
    );
  });

  it("no filter returns all issues unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(issueRowArb, { minLength: 0, maxLength: 20 }),
        (issues) => {
          const filtered = filterIssuesByType(issues, undefined);
          expect(filtered.length).toBe(issues.length);
          expect(filtered.map((i) => i.id)).toEqual(issues.map((i) => i.id));
        },
      ),
      { numRuns: 100 },
    );
  });
});
