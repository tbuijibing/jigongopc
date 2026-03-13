/**
 * Hook handlers for the Global Collaboration module.
 *
 * Each factory receives (db, core) or (db, core, presenceManager) and returns
 * an async handler. Handlers use try/catch for fault isolation (Req 14.1) —
 * errors are logged but never thrown, so core operations are never blocked.
 */

import type { CoreServices } from "./types.js";
import type { PresenceManager } from "./services/presence.js";
import { NotificationService } from "./services/notification.js";
import { parseMentions } from "./services/mention.js";

/** Hook factory: issue:created (reserved for future use) */
export function onIssueCreated(_db: any, _core: CoreServices) {
  return async (_payload: { issue: any }) => {
    // Reserved for future extension (e.g. auto-notify project watchers)
  };
}

/**
 * Hook factory: issue:assigned → create assignment notification.
 * Validates: Requirement 8.1
 */
export function onIssueAssigned(db: any, core: CoreServices) {
  return async (payload: { issue: any; agent: any }) => {
    try {
      const { issue } = payload;

      // Only notify when assigned to a human user
      if (!issue.assigneeUserId) return;

      const svc = new NotificationService(db);

      // Determine actor from payload — default to "system" if not available
      const actorType = (payload as any).actorType ?? "system";
      const actorId = (payload as any).actorId ?? "system";

      await svc.create({
        companyId: issue.companyId,
        recipientUserId: issue.assigneeUserId,
        type: "assignment",
        title: `Issue ${issue.slug ?? issue.id} assigned to you`,
        entityType: "issue",
        entityId: issue.id,
        actorType,
        actorId,
      });
    } catch (err) {
      // Fault isolation (Req 14.1): log but don't throw
      console.error("[global-collab] onIssueAssigned hook error:", err);
    }
  };
}

/**
 * Hook factory: issue:status_changed → create status_change notification.
 * Validates: Requirement 8.2
 */
export function onIssueStatusChanged(db: any, _core: CoreServices) {
  return async (payload: { issue: any; from: string; to: string }) => {
    try {
      const { issue, from, to } = payload;

      // Only notify when the assignee is a human user
      if (!issue.assigneeUserId) return;

      const svc = new NotificationService(db);

      // Actor is typically the agent or system that changed the status
      const actorType = issue.assigneeAgentId ? "agent" : "system";
      const actorId = issue.assigneeAgentId ?? "system";

      await svc.create({
        companyId: issue.companyId,
        recipientUserId: issue.assigneeUserId,
        type: "status_change",
        title: `Issue ${issue.slug ?? issue.id} status: ${from} → ${to}`,
        entityType: "issue",
        entityId: issue.id,
        actorType,
        actorId,
      });
    } catch (err) {
      // Fault isolation (Req 14.1): log but don't throw
      console.error("[global-collab] onIssueStatusChanged hook error:", err);
    }
  };
}

/**
 * Hook factory: issue:comment.created → parse mentions, create notifications.
 * Validates: Requirements 8.3, 9.1, 9.2, 9.3
 */
export function onCommentCreated(
  db: any,
  core: CoreServices,
  presenceManager: PresenceManager,
) {
  return async (payload: {
    issue: any;
    comment: any;
    actor: { actorType: string; actorId: string };
  }) => {
    try {
      const { issue, comment, actor } = payload;
      const companyId = issue.companyId;

      // Step 1: Parse all @mentions from comment body
      const mentions = await parseMentions(companyId, comment.body, core);

      // Step 2: Collect target user IDs — start with explicitly mentioned users
      let targetUserIds = [...mentions.userIds];

      // Handle @human wildcard (Req 9.1, 9.2): notify non-offline users
      if (mentions.hasHumanMention) {
        const presenceList = presenceManager.getPresence(companyId);
        const nonOfflineUserIds = presenceList
          .filter((u) => u.status !== "offline")
          .map((u) => u.userId);
        // Merge and deduplicate
        targetUserIds = [...new Set([...targetUserIds, ...nonOfflineUserIds])];
      }

      // Step 3: Filter out the comment author (don't notify yourself)
      const recipientIds = targetUserIds.filter(
        (id) => !(actor.actorType === "user" && actor.actorId === id),
      );

      if (recipientIds.length === 0) return;

      // Step 4: Batch create mention notifications
      const svc = new NotificationService(db);

      await svc.createBatch(
        recipientIds.map((userId) => ({
          companyId,
          recipientUserId: userId,
          type: "mention",
          title: `You were mentioned in ${issue.slug ?? issue.id}`,
          body: comment.body ? comment.body.substring(0, 200) : null,
          entityType: "comment",
          entityId: comment.id,
          actorType: actor.actorType,
          actorId: actor.actorId,
        })),
      );
    } catch (err) {
      // Fault isolation (Req 14.1): log but don't throw
      console.error("[global-collab] onCommentCreated hook error:", err);
    }
  };
}

/** Hook factory: agent:heartbeat (reserved for presence integration) */
export function onAgentHeartbeat(_presenceManager: PresenceManager) {
  return async (_payload: { agentId: string; timestamp: Date; meta: any }) => {
    // Reserved for agent presence tracking (Task 8)
  };
}
