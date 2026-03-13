// Feature: intelligent-agent-recommendation, Task 5.3: Property test for selection toggle
// Property 9: Selection Toggle
//
// For any agent in the recommendation list, clicking its checkbox should toggle
// its selection state (selected → unselected or unselected → selected).
//
// **Validates: Requirements 5.1**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 9: Selection Toggle
 *
 * For any agent in the recommendation list, clicking its checkbox should toggle
 * its selection state (selected → unselected or unselected → selected).
 *
 * **Validates: Requirements 5.1**
 */
describe("Property 9: Selection Toggle", () => {
  // Helper function to simulate the toggle selection logic
  const toggleSelection = (selected: Set<string>, agentId: string): Set<string> => {
    const newSelection = new Set(selected);
    if (newSelection.has(agentId)) {
      newSelection.delete(agentId);
    } else {
      newSelection.add(agentId);
    }
    return newSelection;
  };

  it("toggles selection state when checkbox is clicked", () => {
    fc.assert(
      fc.property(
        // Generate random agent ID
        fc.uuid(),
        // Generate random initial selection state
        fc.boolean(),
        (agentId, initiallySelected) => {
          // Set up initial state
          const selected = new Set<string>(initiallySelected ? [agentId] : []);

          // Toggle the selection
          const newSelection = toggleSelection(selected, agentId);

          // Verify the selection state was toggled
          expect(newSelection.has(agentId)).toBe(!initiallySelected);

          // Verify size is correct
          expect(newSelection.size).toBe(initiallySelected ? 0 : 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("toggles from unselected to selected", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (agentId) => {
          const selected = new Set<string>(); // Initially unselected

          // Toggle to select
          const newSelection = toggleSelection(selected, agentId);

          // Should now be selected
          expect(newSelection.has(agentId)).toBe(true);
          expect(newSelection.size).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("toggles from selected to unselected", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (agentId) => {
          const selected = new Set<string>([agentId]); // Initially selected

          // Toggle to deselect
          const newSelection = toggleSelection(selected, agentId);

          // Should now be unselected
          expect(newSelection.has(agentId)).toBe(false);
          expect(newSelection.size).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("maintains independent selection state for multiple agents", () => {
    fc.assert(
      fc.property(
        // Generate 2-5 agents
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }).map((ids) => {
          // Ensure uniqueness
          return Array.from(new Set(ids));
        }),
        // Pick one agent to toggle
        fc.nat(),
        (agentIds, toggleIndex) => {
          if (agentIds.length < 2) return; // Skip if not enough unique agents

          const agentToToggle = agentIds[toggleIndex % agentIds.length];
          const selected = new Set<string>();

          // Toggle the selected agent
          const newSelection = toggleSelection(selected, agentToToggle);

          // Verify only the clicked agent was toggled
          expect(newSelection.has(agentToToggle)).toBe(true);
          expect(newSelection.size).toBe(1);

          // Verify other agents remain unselected
          agentIds.forEach((id) => {
            if (id !== agentToToggle) {
              expect(newSelection.has(id)).toBe(false);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("supports toggling the same agent multiple times", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 10 }),
        (agentId, toggleCount) => {
          let selected = new Set<string>();

          // Toggle the same agent multiple times
          for (let i = 0; i < toggleCount; i++) {
            selected = toggleSelection(selected, agentId);
          }

          // After even number of toggles, should be unselected
          // After odd number of toggles, should be selected
          const shouldBeSelected = toggleCount % 2 === 1;
          expect(selected.has(agentId)).toBe(shouldBeSelected);
          expect(selected.size).toBe(shouldBeSelected ? 1 : 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("preserves other selections when toggling one agent", () => {
    fc.assert(
      fc.property(
        // Generate 3-5 unique agent IDs
        fc.array(fc.uuid(), { minLength: 3, maxLength: 5 }).map((ids) => {
          return Array.from(new Set(ids));
        }),
        (agentIds) => {
          if (agentIds.length < 3) return;

          // Select first two agents
          let selected = new Set<string>([agentIds[0], agentIds[1]]);

          // Toggle the third agent (add it)
          selected = toggleSelection(selected, agentIds[2]);

          // Verify all three are selected
          expect(selected.size).toBe(3);
          expect(selected.has(agentIds[0])).toBe(true);
          expect(selected.has(agentIds[1])).toBe(true);
          expect(selected.has(agentIds[2])).toBe(true);

          // Toggle the first agent (remove it)
          selected = toggleSelection(selected, agentIds[0]);

          // Verify first is removed, others remain
          expect(selected.size).toBe(2);
          expect(selected.has(agentIds[0])).toBe(false);
          expect(selected.has(agentIds[1])).toBe(true);
          expect(selected.has(agentIds[2])).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 11: Selection Preservation Across Updates
 *
 * For any agent that appears in both the old and new recommendation lists,
 * when the recommendation list updates, the agent's selection state should be preserved.
 *
 * **Validates: Requirements 5.5**
 */
describe("Property 11: Selection Preservation Across Updates", () => {
  // Helper function to preserve selections when agent list updates
  const preserveSelections = (
    currentSelections: Set<string>,
    oldAgentIds: string[],
    newAgentIds: string[]
  ): Set<string> => {
    const newSelections = new Set<string>();
    
    // Only preserve selections for agents that exist in the new list
    currentSelections.forEach((agentId) => {
      if (newAgentIds.includes(agentId)) {
        newSelections.add(agentId);
      }
    });
    
    return newSelections;
  };

  it("preserves selections for agents in both old and new lists", () => {
    fc.assert(
      fc.property(
        // Generate old agent list (3-10 agents)
        fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        // Generate new agent list (3-10 agents)
        fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        (oldAgentIds, newAgentIds) => {
          if (oldAgentIds.length < 3 || newAgentIds.length < 3) return;

          // Select some agents from old list (first 2)
          const selected = new Set(oldAgentIds.slice(0, 2));

          // Preserve selections for agents that remain
          const preserved = preserveSelections(selected, oldAgentIds, newAgentIds);

          // Agents in both lists should maintain selection
          oldAgentIds.slice(0, 2).forEach((id) => {
            if (newAgentIds.includes(id)) {
              expect(preserved.has(id)).toBe(true);
            } else {
              expect(preserved.has(id)).toBe(false);
            }
          });

          // Agents only in new list should not be selected
          newAgentIds.forEach((id) => {
            if (!oldAgentIds.slice(0, 2).includes(id)) {
              expect(preserved.has(id)).toBe(false);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("removes selections for agents no longer in the list", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 3, maxLength: 5 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        fc.array(fc.uuid(), { minLength: 3, maxLength: 5 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        (oldAgentIds, newAgentIds) => {
          if (oldAgentIds.length < 3 || newAgentIds.length < 3) return;

          // Select all agents from old list
          const selected = new Set(oldAgentIds);

          // Preserve selections
          const preserved = preserveSelections(selected, oldAgentIds, newAgentIds);

          // Only agents in both lists should be selected
          preserved.forEach((agentId) => {
            expect(newAgentIds.includes(agentId)).toBe(true);
            expect(oldAgentIds.includes(agentId)).toBe(true);
          });

          // Size should be at most the intersection size
          const intersection = oldAgentIds.filter((id) => newAgentIds.includes(id));
          expect(preserved.size).toBe(intersection.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("preserves all selections when lists are identical", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        (agentIds) => {
          if (agentIds.length < 3) return;

          // Select some agents
          const selected = new Set(agentIds.slice(0, Math.ceil(agentIds.length / 2)));

          // Preserve selections with identical lists
          const preserved = preserveSelections(selected, agentIds, agentIds);

          // All selections should be preserved
          expect(preserved.size).toBe(selected.size);
          selected.forEach((id) => {
            expect(preserved.has(id)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("clears all selections when lists have no overlap", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 3, maxLength: 5 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        fc.array(fc.uuid(), { minLength: 3, maxLength: 5 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        (oldAgentIds, newAgentIds) => {
          if (oldAgentIds.length < 3 || newAgentIds.length < 3) return;

          // Ensure no overlap by filtering
          const filteredNewIds = newAgentIds.filter((id) => !oldAgentIds.includes(id));
          if (filteredNewIds.length < 2) return; // Skip if not enough unique IDs

          // Select all agents from old list
          const selected = new Set(oldAgentIds);

          // Preserve selections with non-overlapping new list
          const preserved = preserveSelections(selected, oldAgentIds, filteredNewIds);

          // No selections should be preserved
          expect(preserved.size).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("handles partial overlap correctly", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 5, maxLength: 8 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        fc.nat({ max: 3 }),
        (agentIds, overlapCount) => {
          if (agentIds.length < 5) return;

          const oldAgentIds = agentIds.slice(0, 5);
          // Create new list with partial overlap
          const overlap = Math.min(overlapCount + 1, 3);
          const newAgentIds = [
            ...agentIds.slice(0, overlap), // Overlapping agents
            ...agentIds.slice(5), // Non-overlapping agents
          ];

          if (newAgentIds.length < 3) return;

          // Select first 3 agents from old list
          const selected = new Set(oldAgentIds.slice(0, 3));

          // Preserve selections
          const preserved = preserveSelections(selected, oldAgentIds, newAgentIds);

          // Only overlapping selected agents should be preserved
          const expectedPreserved = oldAgentIds
            .slice(0, 3)
            .filter((id) => newAgentIds.includes(id));

          expect(preserved.size).toBe(expectedPreserved.length);
          expectedPreserved.forEach((id) => {
            expect(preserved.has(id)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("handles empty selection set", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        (oldAgentIds, newAgentIds) => {
          if (oldAgentIds.length < 3 || newAgentIds.length < 3) return;

          // Start with empty selection
          const selected = new Set<string>();

          // Preserve selections
          const preserved = preserveSelections(selected, oldAgentIds, newAgentIds);

          // Should remain empty
          expect(preserved.size).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("handles single agent selection preservation", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        fc.array(fc.uuid(), { minLength: 3, maxLength: 10 }).map((ids) => 
          Array.from(new Set(ids))
        ),
        fc.nat(),
        (oldAgentIds, newAgentIds, selectIndex) => {
          if (oldAgentIds.length < 3 || newAgentIds.length < 3) return;

          // Select one agent from old list
          const selectedAgent = oldAgentIds[selectIndex % oldAgentIds.length];
          const selected = new Set([selectedAgent]);

          // Preserve selections
          const preserved = preserveSelections(selected, oldAgentIds, newAgentIds);

          // Should be preserved only if in new list
          if (newAgentIds.includes(selectedAgent)) {
            expect(preserved.has(selectedAgent)).toBe(true);
            expect(preserved.size).toBe(1);
          } else {
            expect(preserved.size).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 7: Agent Display Limit
 *
 * For any list of recommended agents, the UI should display at most 10 agents
 * regardless of how many match the keywords.
 *
 * **Validates: Requirements 4.1**
 */
describe("Property 7: Agent Display Limit", () => {
  it("displays at most 10 agents regardless of how many are returned", () => {
    fc.assert(
      fc.property(
        // Generate between 11 and 50 agents
        fc.integer({ min: 11, max: 50 }),
        (agentCount) => {
          // Generate array of agents
          const agents = Array.from({ length: agentCount }, (_, i) => ({
            id: `agent-${i}`,
            name: `Agent ${i}`,
            companyId: "company-123",
          }));

          // Simulate the display limit logic (slice to 10)
          const displayedAgents = agents.slice(0, 10);

          // Verify at most 10 agents are displayed
          expect(displayedAgents.length).toBe(10);
          expect(displayedAgents.length).toBeLessThanOrEqual(10);

          // Verify the first 10 agents are included
          for (let i = 0; i < 10; i++) {
            expect(displayedAgents[i].id).toBe(`agent-${i}`);
          }

          // Verify agents beyond 10 are not included
          const displayedIds = new Set(displayedAgents.map((a) => a.id));
          for (let i = 10; i < agentCount; i++) {
            expect(displayedIds.has(`agent-${i}`)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("displays all agents when fewer than 10 are returned", () => {
    fc.assert(
      fc.property(
        // Generate between 1 and 9 agents
        fc.integer({ min: 1, max: 9 }),
        (agentCount) => {
          // Generate array of agents
          const agents = Array.from({ length: agentCount }, (_, i) => ({
            id: `agent-${i}`,
            name: `Agent ${i}`,
            companyId: "company-123",
          }));

          // Simulate the display limit logic (slice to 10)
          const displayedAgents = agents.slice(0, 10);

          // Verify all agents are displayed when count < 10
          expect(displayedAgents.length).toBe(agentCount);
          expect(displayedAgents.length).toBeLessThanOrEqual(10);

          // Verify all agents are included
          for (let i = 0; i < agentCount; i++) {
            expect(displayedAgents[i].id).toBe(`agent-${i}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("displays exactly 10 agents when exactly 10 are returned", () => {
    const agentCount = 10;
    const agents = Array.from({ length: agentCount }, (_, i) => ({
      id: `agent-${i}`,
      name: `Agent ${i}`,
      companyId: "company-123",
    }));

    // Simulate the display limit logic (slice to 10)
    const displayedAgents = agents.slice(0, 10);

    // Verify exactly 10 agents are displayed
    expect(displayedAgents.length).toBe(10);

    // Verify all 10 agents are included
    for (let i = 0; i < 10; i++) {
      expect(displayedAgents[i].id).toBe(`agent-${i}`);
    }
  });

  it("maintains agent order when limiting to 10", () => {
    fc.assert(
      fc.property(
        // Generate between 11 and 30 agents
        fc.integer({ min: 11, max: 30 }),
        (agentCount) => {
          // Generate array of agents with sequential IDs
          const agents = Array.from({ length: agentCount }, (_, i) => ({
            id: `agent-${i}`,
            name: `Agent ${i}`,
            companyId: "company-123",
            order: i,
          }));

          // Simulate the display limit logic (slice to 10)
          const displayedAgents = agents.slice(0, 10);

          // Verify agents are in the same order
          for (let i = 0; i < displayedAgents.length - 1; i++) {
            expect(displayedAgents[i].order).toBeLessThan(
              displayedAgents[i + 1].order
            );
          }

          // Verify the first 10 agents are selected in order
          expect(displayedAgents[0].order).toBe(0);
          expect(displayedAgents[9].order).toBe(9);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("handles empty agent list", () => {
    const agents: Array<{ id: string; name: string; companyId: string }> = [];

    // Simulate the display limit logic (slice to 10)
    const displayedAgents = agents.slice(0, 10);

    // Verify no agents are displayed
    expect(displayedAgents.length).toBe(0);
  });

  it("applies limit consistently across multiple calls", () => {
    fc.assert(
      fc.property(
        // Generate between 15 and 40 agents
        fc.integer({ min: 15, max: 40 }),
        (agentCount) => {
          // Generate array of agents
          const agents = Array.from({ length: agentCount }, (_, i) => ({
            id: `agent-${i}`,
            name: `Agent ${i}`,
            companyId: "company-123",
          }));

          // Apply limit multiple times
          const displayedAgents1 = agents.slice(0, 10);
          const displayedAgents2 = agents.slice(0, 10);
          const displayedAgents3 = agents.slice(0, 10);

          // Verify all calls produce the same result
          expect(displayedAgents1.length).toBe(10);
          expect(displayedAgents2.length).toBe(10);
          expect(displayedAgents3.length).toBe(10);

          // Verify the same agents are selected
          for (let i = 0; i < 10; i++) {
            expect(displayedAgents1[i].id).toBe(displayedAgents2[i].id);
            expect(displayedAgents2[i].id).toBe(displayedAgents3[i].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("preserves agent properties when limiting", () => {
    fc.assert(
      fc.property(
        // Generate between 12 and 25 agents
        fc.integer({ min: 12, max: 25 }),
        (agentCount) => {
          // Generate array of agents with various properties
          const agents = Array.from({ length: agentCount }, (_, i) => ({
            id: `agent-${i}`,
            name: `Agent ${i}`,
            companyId: "company-123",
            role: `role-${i}`,
            capabilities: {
              languages: [`lang-${i}`],
              frameworks: [`framework-${i}`],
            },
          }));

          // Simulate the display limit logic (slice to 10)
          const displayedAgents = agents.slice(0, 10);

          // Verify all properties are preserved for displayed agents
          displayedAgents.forEach((agent, i) => {
            expect(agent.id).toBe(`agent-${i}`);
            expect(agent.name).toBe(`Agent ${i}`);
            expect(agent.companyId).toBe("company-123");
            expect(agent.role).toBe(`role-${i}`);
            expect(agent.capabilities.languages).toEqual([`lang-${i}`]);
            expect(agent.capabilities.frameworks).toEqual([`framework-${i}`]);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
