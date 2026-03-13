import { and, eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import {
  agents,
  companyMemberships,
  issues,
  issueWatchers,
  agentWakeupRequests,
} from "@jigongai/db";
import { WATCHER_TYPES } from "@jigongai/shared";
import { notFound, unprocessable } from "../errors.js";

function validateWatcherType(type: string): void {
  if (!(WATCHER_TYPES as readonly string[]).includes(type)) {
    throw unprocessable(
      `Invalid watcherType '${type}'. Must be one of: ${WATCHER_TYPES.join(", ")}`,
    );
  }
}

export function issueWatcherService(db: Db) {
  async function ensureIssueBelongsToCompany(
    companyId: string,
    issueId: string,
  ): Promise<{ id: string; companyId: string }> {
    const issue = await db
      .select({ id: issues.id, companyId: issues.companyId })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!issue) {
      throw notFound("Issue not found in this company");
    }
    return issue;
  }

  async function ensureAgentBelongsToCompany(
    companyId: string,
    agentId: string,
  ): Promise<void> {
    const agent = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!agent) {
      throw notFound("Agent not found in this company");
    }
  }

  async function ensureUserBelongsToCompany(
    companyId: string,
    userId: string,
  ): Promise<void> {
    const membership = await db
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
          eq(companyMemberships.status, "active"),
        ),
      )
      .then((rows) => rows[0] ?? null);
    if (!membership) {
      throw notFound("User not found in this company");
    }
  }

  return {
    addWatcher: async (
      companyId: string,
      issueId: string,
      watcherType: string,
      watcherId: string,
    ) => {
      validateWatcherType(watcherType);
      await ensureIssueBelongsToCompany(companyId, issueId);

      // Verify watcher belongs to the same company
      if (watcherType === "agent") {
        await ensureAgentBelongsToCompany(companyId, watcherId);
      } else {
        await ensureUserBelongsToCompany(companyId, watcherId);
      }

      try {
        return await db
          .insert(issueWatchers)
          .values({ companyId, issueId, watcherType, watcherId })
          .returning()
          .then((rows) => rows[0]);
      } catch (err: any) {
        if (err.code === "23505") {
          throw unprocessable("This watcher is already watching this issue");
        }
        throw err;
      }
    },

    removeWatcher: async (
      companyId: string,
      issueId: string,
      watcherId: string,
    ) => {
      const deleted = await db
        .delete(issueWatchers)
        .where(
          and(
            eq(issueWatchers.companyId, companyId),
            eq(issueWatchers.issueId, issueId),
            eq(issueWatchers.id, watcherId),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!deleted) {
        throw notFound("Watcher not found");
      }
      return deleted;
    },

    getWatchers: async (companyId: string, issueId: string) => {
      return db
        .select()
        .from(issueWatchers)
        .where(
          and(
            eq(issueWatchers.companyId, companyId),
            eq(issueWatchers.issueId, issueId),
          ),
        );
    },

    notifyWatchers: async (issueId: string, newStatus: string) => {
      // Fetch all watchers for this issue (no company filter needed — issueId is sufficient)
      const watchers = await db
        .select()
        .from(issueWatchers)
        .where(eq(issueWatchers.issueId, issueId));

      if (watchers.length === 0) return;

      // Fetch the issue to get companyId for wakeup requests
      const issue = await db
        .select({ id: issues.id, companyId: issues.companyId })
        .from(issues)
        .where(eq(issues.id, issueId))
        .then((rows) => rows[0] ?? null);

      if (!issue) return;

      for (const watcher of watchers) {
        if (watcher.watcherType === "agent") {
          // Create a WakeupRequest to wake the agent
          await db.insert(agentWakeupRequests).values({
            companyId: issue.companyId,
            agentId: watcher.watcherId,
            source: "watcher",
            triggerDetail: `Issue ${issueId} status changed to ${newStatus}`,
            reason: `Watched issue status changed to ${newStatus}`,
            payload: { issueId, newStatus },
            status: "queued",
            requestedByActorType: "system",
            requestedByActorId: "issue-watcher",
          });
        } else {
          // User watcher — log the notification event for UI consumption
          console.log(
            `[issue-watcher] Notification for user ${watcher.watcherId}: issue ${issueId} status changed to ${newStatus}`,
          );
        }
      }
    },
  };
}
