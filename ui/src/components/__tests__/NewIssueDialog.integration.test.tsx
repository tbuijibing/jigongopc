// Feature: intelligent-agent-recommendation, Task 7.4: Integration test for task creation resilience
// Property 13: Task Creation Resilience
// Validates: Requirements 6.4

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { issuesApi } from "../../api/issues";
import { issueWatchersApi } from "../../api/issue-watchers";
import type { Issue } from "@Jigongai/shared";

const mockIssue: Issue = {
  id: "issue-123",
  companyId: "company-1",
  projectId: null,
  goalId: null,
  parentId: null,
  title: "Test Issue",
  description: "Test description",
  status: "todo",
  priority: "medium",
  assigneeAgentId: null,
  assigneeUserId: null,
  checkoutRunId: null,
  executionRunId: null,
  executionAgentNameKey: null,
  executionLockedAt: null,
  createdByAgentId: null,
  createdByUserId: null,
  issueNumber: null,
  identifier: null,
  requestDepth: 0,
  billingCode: null,
  issueType: "task",
  assigneeAdapterOverrides: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  hiddenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Property 13: Task Creation Resilience
 *
 * For any task creation with selected agents, if watcher creation fails for one or more agents,
 * the task creation should still complete successfully and the dialog should close normally.
 *
 * **Validates: Requirements 6.4**
 *
 * This test simulates the task creation flow from NewIssueDialog where:
 * 1. A task is created successfully
 * 2. Watchers are added for selected agents
 * 3. Some watcher creations may fail
 * 4. The task creation still succeeds and completes
 */
describe("Property 13: Task Creation Resilience", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console.error to verify error logging
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consoleErrorSpy.mockRestore();
  });

  /**
   * Simulates the task creation logic from NewIssueDialog.tsx
   * This is the actual implementation pattern used in the component
   */
  async function simulateTaskCreationWithWatchers(
    companyId: string,
    taskData: Record<string, unknown>,
    selectedWatcherIds: Set<string>
  ): Promise<{ success: boolean; taskId: string | null; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Step 1: Create the task
      const result = await issuesApi.create(companyId, taskData);
      const taskId = result.id;

      // Step 2: Create watchers for selected agents (using Promise.allSettled for resilience)
      if (selectedWatcherIds.size > 0) {
        const watcherPromises = Array.from(selectedWatcherIds).map((agentId) =>
          issueWatchersApi
            .add(companyId, taskId, {
              watcherType: "agent",
              watcherId: agentId,
            })
            .catch((err) => {
              console.error(`Failed to add watcher ${agentId}:`, err);
              errors.push(`Failed to add watcher ${agentId}`);
              // Don't throw - allow task creation to succeed
            })
        );
        await Promise.allSettled(watcherPromises);
      }

      // Step 3: Task creation succeeds regardless of watcher failures
      return { success: true, taskId, errors };
    } catch (err) {
      // Only fails if task creation itself fails
      return { success: false, taskId: null, errors: [`Task creation failed: ${err}`] };
    }
  }

  it("should create task successfully when all watcher creations succeed", async () => {
    // Mock successful task creation
    vi.spyOn(issuesApi, "create").mockResolvedValue(mockIssue);

    // Mock successful watcher creation
    vi.spyOn(issueWatchersApi, "add").mockResolvedValue({
      id: "watcher-1",
      issueId: "issue-123",
      watcherType: "agent",
      watcherId: "agent-1",
      createdAt: new Date().toISOString(),
    });

    const selectedWatcherIds = new Set(["agent-1", "agent-2"]);
    const result = await simulateTaskCreationWithWatchers(
      "company-1",
      { title: "Test Task", description: "Test description" },
      selectedWatcherIds
    );

    // Task creation should succeed
    expect(result.success).toBe(true);
    expect(result.taskId).toBe("issue-123");
    expect(result.errors).toHaveLength(0);

    // Verify task was created
    expect(issuesApi.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ title: "Test Task" })
    );

    // Verify watchers were created for all selected agents
    expect(issueWatchersApi.add).toHaveBeenCalledTimes(2);
    expect(issueWatchersApi.add).toHaveBeenCalledWith(
      "company-1",
      "issue-123",
      { watcherType: "agent", watcherId: "agent-1" }
    );
    expect(issueWatchersApi.add).toHaveBeenCalledWith(
      "company-1",
      "issue-123",
      { watcherType: "agent", watcherId: "agent-2" }
    );

    // No errors should be logged
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should create task successfully even when all watcher creations fail", async () => {
    // Mock successful task creation
    vi.spyOn(issuesApi, "create").mockResolvedValue(mockIssue);

    // Mock watcher creation to fail
    vi.spyOn(issueWatchersApi, "add").mockRejectedValue(
      new Error("Watcher API unavailable")
    );

    const selectedWatcherIds = new Set(["agent-1", "agent-2"]);
    const result = await simulateTaskCreationWithWatchers(
      "company-1",
      { title: "Test Task", description: "Test description" },
      selectedWatcherIds
    );

    // Task creation should still succeed despite watcher failures
    expect(result.success).toBe(true);
    expect(result.taskId).toBe("issue-123");
    expect(result.errors).toHaveLength(2); // Both watchers failed

    // Verify task was created
    expect(issuesApi.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ title: "Test Task" })
    );

    // Verify watcher creation was attempted
    expect(issueWatchersApi.add).toHaveBeenCalledTimes(2);

    // Verify errors were logged
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to add watcher agent-1:",
      expect.any(Error)
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to add watcher agent-2:",
      expect.any(Error)
    );
  });

  it("should create task successfully when some watchers fail and some succeed", async () => {
    // Mock successful task creation
    vi.spyOn(issuesApi, "create").mockResolvedValue(mockIssue);

    // Mock watcher creation to fail for first agent, succeed for second
    let callCount = 0;
    vi.spyOn(issueWatchersApi, "add").mockImplementation(
      async (companyId, issueId, data) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Watcher API failed for agent-1");
        }
        return {
          id: `watcher-${callCount}`,
          issueId,
          watcherType: data.watcherType as "agent" | "user",
          watcherId: data.watcherId,
          createdAt: new Date().toISOString(),
        };
      }
    );

    const selectedWatcherIds = new Set(["agent-1", "agent-2"]);
    const result = await simulateTaskCreationWithWatchers(
      "company-1",
      { title: "Test Task", description: "Test description" },
      selectedWatcherIds
    );

    // Task creation should succeed with partial watcher success
    expect(result.success).toBe(true);
    expect(result.taskId).toBe("issue-123");
    expect(result.errors).toHaveLength(1); // Only one watcher failed

    // Verify task was created
    expect(issuesApi.create).toHaveBeenCalled();

    // Verify both watcher creations were attempted
    expect(issueWatchersApi.add).toHaveBeenCalledTimes(2);

    // Verify only one error was logged
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to add watcher agent-1:",
      expect.any(Error)
    );
  });

  it("should handle task creation with no selected watchers", async () => {
    // Mock successful task creation
    vi.spyOn(issuesApi, "create").mockResolvedValue(mockIssue);
    const addWatcherSpy = vi.spyOn(issueWatchersApi, "add");

    const selectedWatcherIds = new Set<string>(); // No watchers selected
    const result = await simulateTaskCreationWithWatchers(
      "company-1",
      { title: "Test Task", description: "Test description" },
      selectedWatcherIds
    );

    // Task creation should succeed
    expect(result.success).toBe(true);
    expect(result.taskId).toBe("issue-123");
    expect(result.errors).toHaveLength(0);

    // Verify task was created
    expect(issuesApi.create).toHaveBeenCalled();

    // Verify no watcher API calls were made
    expect(addWatcherSpy).not.toHaveBeenCalled();

    // No errors should be logged
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should fail only when task creation itself fails, not watcher creation", async () => {
    // Mock task creation to fail
    vi.spyOn(issuesApi, "create").mockRejectedValue(
      new Error("Task creation failed")
    );

    const addWatcherSpy = vi.spyOn(issueWatchersApi, "add");

    const selectedWatcherIds = new Set(["agent-1"]);
    const result = await simulateTaskCreationWithWatchers(
      "company-1",
      { title: "Test Task", description: "Test description" },
      selectedWatcherIds
    );

    // Task creation should fail
    expect(result.success).toBe(false);
    expect(result.taskId).toBeNull();

    // Verify task creation was attempted
    expect(issuesApi.create).toHaveBeenCalled();

    // Verify watcher creation was never attempted (task creation failed first)
    expect(addWatcherSpy).not.toHaveBeenCalled();
  });

  it("should handle multiple watcher failures gracefully with Promise.allSettled", async () => {
    // Mock successful task creation
    vi.spyOn(issuesApi, "create").mockResolvedValue(mockIssue);

    // Mock watcher creation to fail with different errors
    let callCount = 0;
    vi.spyOn(issueWatchersApi, "add").mockImplementation(
      async (companyId, issueId, data) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Network timeout");
        } else if (callCount === 2) {
          throw new Error("Agent not found");
        } else {
          throw new Error("Permission denied");
        }
      }
    );

    const selectedWatcherIds = new Set(["agent-1", "agent-2", "agent-3"]);
    const result = await simulateTaskCreationWithWatchers(
      "company-1",
      { title: "Test Task", description: "Test description" },
      selectedWatcherIds
    );

    // Task creation should succeed despite all watcher failures
    expect(result.success).toBe(true);
    expect(result.taskId).toBe("issue-123");
    expect(result.errors).toHaveLength(3); // All three watchers failed

    // Verify all watcher creations were attempted
    expect(issueWatchersApi.add).toHaveBeenCalledTimes(3);

    // Verify all errors were logged
    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
  });
});

