import { and, eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { issues, agentWakeupRequests, issueDependencies } from "@jigongai/db";

export function collaborationService(db: Db) {
  /**
   * When a child issue transitions to done, check if ALL siblings (same parent)
   * are also done. If so, create a WakeupRequest for the parent issue's assignee.
   * Skips if the issue has no parent or the parent has no assignee.
   *
   * Validates: Requirements 11.1, 11.2, 11.3
   */
  async function checkParentChildCompletion(issueId: string): Promise<void> {
    // 1. Look up the issue to get its parentId
    const issue = await db
      .select({ id: issues.id, parentId: issues.parentId, companyId: issues.companyId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);

    if (!issue) return;

    // 2. If no parentId, this is not a child issue — nothing to do
    if (!issue.parentId) return;

    // 3. Query all sibling issues (same parentId)
    const siblings = await db
      .select({ id: issues.id, status: issues.status })
      .from(issues)
      .where(eq(issues.parentId, issue.parentId));

    // 4. Check if ALL siblings have status 'done'
    const allDone = siblings.length > 0 && siblings.every((s) => s.status === "done");
    if (!allDone) return;

    // 5. Look up the parent issue to get its assigneeAgentId
    const parent = await db
      .select({
        id: issues.id,
        companyId: issues.companyId,
        assigneeAgentId: issues.assigneeAgentId,
      })
      .from(issues)
      .where(eq(issues.id, issue.parentId))
      .then((rows) => rows[0] ?? null);

    if (!parent) return;

    // 6. If parent has no assignee, skip
    if (!parent.assigneeAgentId) return;

    // 7. Create a WakeupRequest for the parent's assignee agent
    await db.insert(agentWakeupRequests).values({
      companyId: parent.companyId,
      agentId: parent.assigneeAgentId,
      source: "parent_child_completion",
      triggerDetail: `All child issues of parent ${parent.id} are done`,
      reason: "All child issues completed",
      payload: { parentIssueId: parent.id, completedChildIssueId: issueId },
      status: "queued",
      requestedByActorType: "system",
      requestedByActorId: "collaboration-service",
    });
  }

  /**
   * When an issue transitions to done, find all issues that depend on it
   * (dependsOnIssueId = this issue, dependencyType = 'blocks').
   * For each dependent issue, check if ALL its blocks-type dependencies are done.
   * If so, create a WakeupRequest for the dependent issue's assignee.
   * Skips if the dependent issue has no assignee.
   *
   * Validates: Requirements 12.1, 12.2, 12.3
   */
  async function checkDependencyWakeup(issueId: string): Promise<void> {
    // 1. Find all issues that depend on the completed issue via 'blocks' type
    //    i.e. rows where dependsOnIssueId = issueId and dependencyType = 'blocks'
    const dependentRecords = await db
      .select({ issueId: issueDependencies.issueId })
      .from(issueDependencies)
      .where(
        and(
          eq(issueDependencies.dependsOnIssueId, issueId),
          eq(issueDependencies.dependencyType, "blocks"),
        ),
      );

    if (dependentRecords.length === 0) return;

    // 2. For each dependent issue, check if ALL its blocks dependencies are done
    for (const dep of dependentRecords) {
      const dependentIssueId = dep.issueId;

      // Get all blocks-type dependencies for this dependent issue
      const allBlockers = await db
        .select({ dependsOnIssueId: issueDependencies.dependsOnIssueId })
        .from(issueDependencies)
        .where(
          and(
            eq(issueDependencies.issueId, dependentIssueId),
            eq(issueDependencies.dependencyType, "blocks"),
          ),
        );

      // Look up the status of each blocker issue
      let allBlockersDone = true;
      for (const blocker of allBlockers) {
        const blockerIssue = await db
          .select({ status: issues.status })
          .from(issues)
          .where(eq(issues.id, blocker.dependsOnIssueId))
          .then((rows) => rows[0] ?? null);

        if (!blockerIssue || blockerIssue.status !== "done") {
          allBlockersDone = false;
          break;
        }
      }

      if (!allBlockersDone) continue;

      // 3. Look up the dependent issue to get its assigneeAgentId
      const dependentIssue = await db
        .select({
          id: issues.id,
          companyId: issues.companyId,
          assigneeAgentId: issues.assigneeAgentId,
        })
        .from(issues)
        .where(eq(issues.id, dependentIssueId))
        .then((rows) => rows[0] ?? null);

      if (!dependentIssue) continue;

      // 4. If dependent issue has no assignee, skip
      if (!dependentIssue.assigneeAgentId) continue;

      // 5. Create a WakeupRequest for the dependent issue's assignee
      await db.insert(agentWakeupRequests).values({
        companyId: dependentIssue.companyId,
        agentId: dependentIssue.assigneeAgentId,
        source: "dependency_wakeup",
        triggerDetail: `All blocks dependencies for issue ${dependentIssue.id} are done`,
        reason: "All blocking dependencies resolved",
        payload: {
          dependentIssueId: dependentIssue.id,
          resolvedBlockerIssueId: issueId,
        },
        status: "queued",
        requestedByActorType: "system",
        requestedByActorId: "collaboration-service",
      });
    }
  }

  return {
    checkParentChildCompletion,
    checkDependencyWakeup,
  };
}
