// Feature: project-lifecycle-ui, Property 9: Capabilities 标签组渲染
// Validates: Req 13.1

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { extractCapabilityTagGroups } from "../lib/capabilities";
import type { AgentCapabilities } from "@Jigongai/shared";

// ---------------------------------------------------------------------------
// Arbitrary for AgentCapabilities with at least one non-empty dimension
// ---------------------------------------------------------------------------

const capabilitiesArb: fc.Arbitrary<AgentCapabilities> = fc.record({
  languages: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  frameworks: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  domains: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  tools: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  customTags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
});

// Ensure at least one dimension is non-empty
const nonEmptyCapabilitiesArb = capabilitiesArb.filter(
  (c) =>
    c.languages.length > 0 ||
    c.frameworks.length > 0 ||
    c.domains.length > 0 ||
    c.tools.length > 0 ||
    c.customTags.length > 0,
);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Capabilities tag group rendering", () => {
  it("renders tag groups for each non-empty dimension with correct tag count", () => {
    fc.assert(
      fc.property(nonEmptyCapabilitiesArb, (capabilities) => {
        const groups = extractCapabilityTagGroups(capabilities);

        const dimensionKeys: (keyof AgentCapabilities)[] = [
          "languages",
          "frameworks",
          "domains",
          "tools",
          "customTags",
        ];

        // Count how many dimensions are non-empty
        const nonEmptyDimensions = dimensionKeys.filter(
          (k) => capabilities[k].length > 0,
        );

        // Number of groups should match number of non-empty dimensions
        expect(groups.length).toBe(nonEmptyDimensions.length);

        // Each group should correspond to a non-empty dimension
        for (const group of groups) {
          const key = group.dimension as keyof AgentCapabilities;
          expect(dimensionKeys).toContain(key);
          expect(capabilities[key].length).toBeGreaterThan(0);
          // Tag count should match array length
          expect(group.tags.length).toBe(capabilities[key].length);
          // Tags should be the same values
          expect(group.tags).toEqual(capabilities[key]);
        }

        // No empty dimensions should appear in groups
        for (const key of dimensionKeys) {
          if (capabilities[key].length === 0) {
            expect(groups.find((g) => g.dimension === key)).toBeUndefined();
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
