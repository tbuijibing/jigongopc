// Feature: project-lifecycle-ui, Property 4: Issue 类型图标映射完整性
// Validates: Req 9.2

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ISSUE_TYPES } from "@Jigongai/shared";
import { getIssueTypeMapping, ISSUE_TYPE_MAP } from "../components/IssueTypeIcon";

describe("Issue type icon mapping completeness (Property 4)", () => {
  it("for any valid issue_type value, getIssueTypeMapping returns a non-null icon component and non-empty label string", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ISSUE_TYPES),
        (issueType) => {
          const mapping = getIssueTypeMapping(issueType);

          // Mapping must exist
          expect(mapping).toBeDefined();
          expect(mapping).not.toBeNull();

          // Icon must be a valid React component (function or object with render)
          expect(mapping.icon).toBeTruthy();
          expect(["function", "object"].includes(typeof mapping.icon)).toBe(true);

          // Label must be a non-empty string
          expect(typeof mapping.label).toBe("string");
          expect(mapping.label.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("ISSUE_TYPE_MAP covers every value in ISSUE_TYPES", () => {
    for (const type of ISSUE_TYPES) {
      expect(ISSUE_TYPE_MAP).toHaveProperty(type);
      const entry = ISSUE_TYPE_MAP[type];
      expect(entry.icon).toBeTruthy();
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});
