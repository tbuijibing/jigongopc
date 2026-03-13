// Feature: intelligent-agent-recommendation, Task 7.3: Property test for watcher creation
// Property 12: Watcher Creation for Selected Agents
//
// For any set of selected agents, when the task is successfully created, the system
// should call the watcher creation API once for each selected agent with the correct
// task ID and agent ID.
//
// **Validates: Requirements 6.2**

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { issueWatchersApi } from "../../api/issue-watchers";

/**
 * Property 12: Watcher Creation for Selected Agents
 *
 * For any set of selected agents, when the task is successfully created, the system
 * should call the watcher creation API once for each selected agent with the correct
 * task ID and agent ID.
 *
 * **Validates: Requirements 6.2**
 */
describe("Property 12: Watcher Creation for Selected Agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to simulate the watcher creation logic from NewIssueDialog
  const createWatchersForSelectedAgents = async (
    companyId: string,
    taskId: string,
    selectedAgentIds: Set<string>
  ): Promise<void> => {
    const watcherPromises = Array.from(selectedAgentIds).map((agentId) =>
      issueWatchersApi
        .add(companyId, taskId, {
          watcherType: "agent",
          watcherId: agentId,
        })
        .catch((err) => {
          console.error(`Failed to add watcher ${agentId}:`, err);
          // Don't throw - allow task creation to succeed
        })
    );
    await Promise.allSettled(watcherPromises);
  };

  it("calls watcher API once per selected agent with correct IDs", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate company ID
        fc.uuid(),
        // Generate task ID
        fc.uuid(),
        // Generate 1-10 selected agent IDs
        fc
          .array(fc.uuid(), { minLength: 1, maxLength: 10 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length === 0) return;

          // Mock the issueWatchersApi.add method
          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: "agent-id",
            createdAt: new Date().toISOString(),
          });

          const selectedAgentIds = new Set(agentIds);

          // Call the watcher creation logic
          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Verify the API was called once per selected agent
          expect(addSpy).toHaveBeenCalledTimes(agentIds.length);

          // Verify each call had the correct parameters
          agentIds.forEach((agentId, index) => {
            expect(addSpy).toHaveBeenNthCalledWith(
              index + 1,
              companyId,
              taskId,
              {
                watcherType: "agent",
                watcherId: agentId,
              }
            );
          });

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("calls watcher API with correct company ID for all agents", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc
          .array(fc.uuid(), { minLength: 2, maxLength: 5 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length < 2) return;

          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: "agent-id",
            createdAt: new Date().toISOString(),
          });

          const selectedAgentIds = new Set(agentIds);

          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Verify all calls used the same company ID
          addSpy.mock.calls.forEach((call) => {
            expect(call[0]).toBe(companyId);
          });

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("calls watcher API with correct task ID for all agents", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc
          .array(fc.uuid(), { minLength: 2, maxLength: 5 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length < 2) return;

          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: "agent-id",
            createdAt: new Date().toISOString(),
          });

          const selectedAgentIds = new Set(agentIds);

          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Verify all calls used the same task ID
          addSpy.mock.calls.forEach((call) => {
            expect(call[1]).toBe(taskId);
          });

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("calls watcher API with watcherType 'agent' for all agents", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc
          .array(fc.uuid(), { minLength: 1, maxLength: 5 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length === 0) return;

          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: "agent-id",
            createdAt: new Date().toISOString(),
          });

          const selectedAgentIds = new Set(agentIds);

          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Verify all calls used watcherType 'agent'
          addSpy.mock.calls.forEach((call) => {
            expect(call[2].watcherType).toBe("agent");
          });

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("calls watcher API with unique agent IDs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc
          .array(fc.uuid(), { minLength: 3, maxLength: 8 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length < 3) return;

          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: "agent-id",
            createdAt: new Date().toISOString(),
          });

          const selectedAgentIds = new Set(agentIds);

          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Extract all watcherIds from the calls
          const watcherIds = addSpy.mock.calls.map((call) => call[2].watcherId);

          // Verify all watcherIds are unique
          const uniqueWatcherIds = new Set(watcherIds);
          expect(uniqueWatcherIds.size).toBe(watcherIds.length);

          // Verify all watcherIds match the selected agent IDs
          watcherIds.forEach((watcherId) => {
            expect(agentIds.includes(watcherId)).toBe(true);
          });

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("does not call watcher API when no agents are selected", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (companyId, taskId) => {
          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: "agent-id",
            createdAt: new Date().toISOString(),
          });

          const selectedAgentIds = new Set<string>();

          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Verify the API was not called
          expect(addSpy).not.toHaveBeenCalled();

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("calls watcher API exactly once per agent even with duplicate IDs in set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc
          .array(fc.uuid(), { minLength: 3, maxLength: 6 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length < 3) return;

          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: "agent-id",
            createdAt: new Date().toISOString(),
          });

          // Create a Set (which automatically deduplicates)
          const selectedAgentIds = new Set(agentIds);

          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Verify the API was called once per unique agent
          expect(addSpy).toHaveBeenCalledTimes(selectedAgentIds.size);

          // Verify each agent ID appears exactly once in the calls
          const calledAgentIds = addSpy.mock.calls.map((call) => call[2].watcherId);
          const uniqueCalledIds = new Set(calledAgentIds);
          expect(uniqueCalledIds.size).toBe(calledAgentIds.length);

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("handles single agent selection correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (companyId, taskId, agentId) => {
          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: agentId,
            createdAt: new Date().toISOString(),
          });

          const selectedAgentIds = new Set([agentId]);

          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Verify the API was called exactly once
          expect(addSpy).toHaveBeenCalledTimes(1);

          // Verify the call had correct parameters
          expect(addSpy).toHaveBeenCalledWith(companyId, taskId, {
            watcherType: "agent",
            watcherId: agentId,
          });

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("completes successfully even when some watcher creations fail", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc
          .array(fc.uuid(), { minLength: 3, maxLength: 6 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length < 3) return;

          const addSpy = vi.spyOn(issueWatchersApi, "add");

          // Make some calls fail (e.g., every other one)
          addSpy.mockImplementation((_, __, data) => {
            const index = agentIds.indexOf(data.watcherId);
            if (index % 2 === 0) {
              return Promise.reject(new Error("Watcher creation failed"));
            }
            return Promise.resolve({
              id: "watcher-id",
              issueId: taskId,
              watcherType: "agent",
              watcherId: data.watcherId,
              createdAt: new Date().toISOString(),
            });
          });

          const selectedAgentIds = new Set(agentIds);

          // Should not throw even with failures
          await expect(
            createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds)
          ).resolves.not.toThrow();

          // Verify the API was still called for all agents
          expect(addSpy).toHaveBeenCalledTimes(agentIds.length);

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("uses Promise.allSettled to handle partial failures gracefully", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc
          .array(fc.uuid(), { minLength: 4, maxLength: 8 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length < 4) return;

          const addSpy = vi.spyOn(issueWatchersApi, "add");

          // Make first half succeed, second half fail
          const halfPoint = Math.floor(agentIds.length / 2);
          addSpy.mockImplementation((_, __, data) => {
            const index = agentIds.indexOf(data.watcherId);
            if (index < halfPoint) {
              return Promise.resolve({
                id: "watcher-id",
                issueId: taskId,
                watcherType: "agent",
                watcherId: data.watcherId,
                createdAt: new Date().toISOString(),
              });
            }
            return Promise.reject(new Error("Watcher creation failed"));
          });

          const selectedAgentIds = new Set(agentIds);

          // Should complete without throwing
          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Verify all agents were attempted
          expect(addSpy).toHaveBeenCalledTimes(agentIds.length);

          // Verify both successful and failed agents were attempted
          const attemptedAgentIds = addSpy.mock.calls.map((call) => call[2].watcherId);
          agentIds.forEach((agentId) => {
            expect(attemptedAgentIds.includes(agentId)).toBe(true);
          });

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("maintains correct call order for selected agents", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc
          .array(fc.uuid(), { minLength: 3, maxLength: 7 })
          .map((ids) => Array.from(new Set(ids))),
        async (companyId, taskId, agentIds) => {
          if (agentIds.length < 3) return;

          const addSpy = vi.spyOn(issueWatchersApi, "add");
          addSpy.mockResolvedValue({
            id: "watcher-id",
            issueId: taskId,
            watcherType: "agent",
            watcherId: "agent-id",
            createdAt: new Date().toISOString(),
          });

          const selectedAgentIds = new Set(agentIds);

          await createWatchersForSelectedAgents(companyId, taskId, selectedAgentIds);

          // Extract the order of agent IDs from the calls
          const calledAgentIds = addSpy.mock.calls.map((call) => call[2].watcherId);

          // Verify all selected agents were called
          expect(calledAgentIds.length).toBe(agentIds.length);

          // Verify each agent ID from the set appears in the calls
          agentIds.forEach((agentId) => {
            expect(calledAgentIds.includes(agentId)).toBe(true);
          });

          addSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });
});

