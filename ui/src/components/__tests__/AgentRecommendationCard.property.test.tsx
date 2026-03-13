// Feature: intelligent-agent-recommendation, Task 4.2: Property test for agent card completeness
// Property 8: Agent Card Completeness
//
// For any recommended agent displayed in the UI, the rendered card should contain
// the agent name, matching capabilities, and a checkbox for selection.
//
// **Validates: Requirements 4.2, 4.3, 4.4**

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as fc from "fast-check";
import type { Agent } from "@Jigongai/shared";
import { AgentRecommendationCard } from "../AgentRecommendationCard";

/**
 * Property 8: Agent Card Completeness
 *
 * For any recommended agent displayed in the UI, the rendered card should contain
 * the agent name, matching capabilities, and a checkbox for selection.
 *
 * **Validates: Requirements 4.2, 4.3, 4.4**
 */
describe("Property 8: Agent Card Completeness", () => {
  afterEach(() => {
    cleanup();
  });

  // Helper function to normalize whitespace for comparison
  const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();

  it("renders agent name, capabilities, and checkbox for any agent", () => {
    fc.assert(
      fc.property(
        // Generate random agent data with meaningful names (alphanumeric)
        fc.record({
          id: fc.uuid(),
          companyId: fc.uuid(),
          name: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,48}[a-zA-Z0-9]$/),
          urlKey: fc.stringMatching(/^[a-z0-9-]{3,30}$/),
          role: fc.constantFrom("engineer", "qa", "designer", "pm", "devops"),
          icon: fc.oneof(fc.constant(null), fc.stringMatching(/^[a-z]{1,20}$/)),
          status: fc.constant("active"),
        }),
        // Generate random matched capabilities with alphanumeric values
        fc.array(
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 .-]{1,18}[a-zA-Z0-9]$/),
          { minLength: 0, maxLength: 10 }
        ),
        // Generate random selection state
        fc.boolean(),
        (agentData, matchedCapabilities, isSelected) => {
          // Create a complete Agent object with required fields
          const agent: Agent = {
            ...agentData,
            title: null,
            reportsTo: null,
            capabilities: {
              languages: [],
              frameworks: [],
              domains: [],
              tools: [],
              customTags: [],
            },
            adapterType: "process",
            adapterConfig: {},
            runtimeConfig: {},
            budgetMonthlyCents: 10000,
            spentMonthlyCents: 0,
            permissions: { canCreateAgents: false },
            lastHeartbeatAt: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const onToggle = vi.fn();

          // Render the component
          const { container } = render(
            <AgentRecommendationCard
              agent={agent}
              isSelected={isSelected}
              onToggle={onToggle}
              matchedCapabilities={matchedCapabilities}
            />
          );

          try {
            // Requirement 4.2: Agent name must be displayed
            // Use custom matcher that normalizes whitespace
            const normalizedName = normalizeWhitespace(agent.name);
            const agentNameElement = screen.getByText((content, element) => {
              return element?.tagName === 'SPAN' && normalizeWhitespace(content) === normalizedName;
            });
            expect(agentNameElement).toBeInTheDocument();

            // Requirement 4.4: Checkbox must be present for selection
            const checkbox = container.querySelector('button[role="checkbox"]');
            expect(checkbox).toBeInTheDocument();
            expect(checkbox).toHaveAttribute("aria-checked", isSelected ? "true" : "false");

            // Requirement 4.3: Matching capabilities must be displayed
            if (matchedCapabilities.length > 0) {
              matchedCapabilities.forEach((capability) => {
                const normalizedCapability = normalizeWhitespace(capability);
                const capabilityElement = screen.getByText((content, element) => {
                  return element?.getAttribute('data-slot') === 'badge' && 
                         normalizeWhitespace(content) === normalizedCapability;
                });
                expect(capabilityElement).toBeInTheDocument();
              });
            }
          } finally {
            // Clean up after each property test iteration
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("renders all required elements for agents with no matched capabilities", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          companyId: fc.uuid(),
          name: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,48}[a-zA-Z0-9]$/),
          urlKey: fc.stringMatching(/^[a-z0-9-]{3,30}$/),
          role: fc.constantFrom("engineer", "qa", "designer", "pm", "devops"),
          icon: fc.oneof(fc.constant(null), fc.stringMatching(/^[a-z]{1,20}$/)),
          status: fc.constant("active"),
        }),
        fc.boolean(),
        (agentData, isSelected) => {
          const agent: Agent = {
            ...agentData,
            title: null,
            reportsTo: null,
            capabilities: {
              languages: [],
              frameworks: [],
              domains: [],
              tools: [],
              customTags: [],
            },
            adapterType: "process",
            adapterConfig: {},
            runtimeConfig: {},
            budgetMonthlyCents: 10000,
            spentMonthlyCents: 0,
            permissions: { canCreateAgents: false },
            lastHeartbeatAt: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const onToggle = vi.fn();

          // Render with empty capabilities
          const { container } = render(
            <AgentRecommendationCard
              agent={agent}
              isSelected={isSelected}
              onToggle={onToggle}
              matchedCapabilities={[]}
            />
          );

          try {
            // Even with no capabilities, name and checkbox must be present
            const normalizedName = normalizeWhitespace(agent.name);
            const agentNameElement = screen.getByText((content, element) => {
              return element?.tagName === 'SPAN' && normalizeWhitespace(content) === normalizedName;
            });
            expect(agentNameElement).toBeInTheDocument();
            
            const checkbox = container.querySelector('button[role="checkbox"]');
            expect(checkbox).toBeInTheDocument();
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("checkbox reflects selection state correctly for any agent", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{2,48}[a-zA-Z0-9]$/),
        fc.boolean(),
        (agentId, agentName, isSelected) => {
          const agent: Agent = {
            id: agentId,
            companyId: "test-company",
            name: agentName,
            urlKey: "test-agent",
            role: "engineer",
            title: null,
            icon: null,
            status: "active",
            reportsTo: null,
            capabilities: {
              languages: [],
              frameworks: [],
              domains: [],
              tools: [],
              customTags: [],
            },
            adapterType: "process",
            adapterConfig: {},
            runtimeConfig: {},
            budgetMonthlyCents: 10000,
            spentMonthlyCents: 0,
            permissions: { canCreateAgents: false },
            lastHeartbeatAt: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const onToggle = vi.fn();

          const { container } = render(
            <AgentRecommendationCard
              agent={agent}
              isSelected={isSelected}
              onToggle={onToggle}
              matchedCapabilities={[]}
            />
          );

          try {
            const checkbox = container.querySelector('button[role="checkbox"]');
            expect(checkbox).toHaveAttribute("aria-checked", isSelected ? "true" : "false");
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
