import { eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, activityLog } from "@jigongai/db";
import { humanAgentControlService } from "./human-agent-controls.js";

export function agentBlockedService(db: Db) {
  return {
    /**
     * Called when an agent is blocked (timeout, error, needs human decision).
     * 1. Updates agent status to 'blocked'
     * 2. Finds the primary controller via humanAgentControlService
     * 3. If primary controller exists, creates a notification (activity_log entry)
     * 4. If no primary controller, logs a warning
     *
     * Validates: Requirements 15.1, 15.2, 15.3, 15.4
     */
    onAgentBlocked: async (companyId: string, agentId: string, reason: string) => {
      // 1. Update agent status to 'blocked'
      await db
        .update(agents)
        .set({ status: "blocked", updatedAt: new Date() })
        .where(eq(agents.id, agentId));

      // 2. Find the primary controller
      const primaryController = await humanAgentControlService(db).findPrimaryController(agentId);

      // 3. If primary controller exists, create a notification via activity_log
      if (primaryController) {
        await db.insert(activityLog).values({
          companyId,
          actorType: "system",
          actorId: "agent-blocked-service",
          action: "agent_blocked",
          entityType: "agent",
          entityId: agentId,
          agentId,
          details: {
            reason,
            primaryControllerUserId: primaryController.userId,
          },
        });

        return { notified: true, userId: primaryController.userId };
      }

      // 4. No primary controller — log warning
      console.warn(
        `Agent ${agentId} is blocked (reason: ${reason}) but has no primary controller`,
      );

      return { notified: false, userId: null };
    },
  };
}
