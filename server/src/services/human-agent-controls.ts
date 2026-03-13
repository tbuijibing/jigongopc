import { and, eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, companyMemberships, humanAgentControls } from "@jigongai/db";
import type { HumanAgentPermissions } from "@jigongai/shared";
import { notFound, unprocessable } from "../errors.js";

export function humanAgentControlService(db: Db) {
  async function ensureAgentBelongsToCompany(
    companyId: string,
    agentId: string,
  ): Promise<void> {
    const agent = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .then((r) => r[0] ?? null);
    if (!agent) throw notFound("Agent not found in this company");
  }

  async function ensureUserBelongsToCompany(
    companyId: string,
    userId: string,
  ): Promise<void> {
    const m = await db
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
      .then((r) => r[0] ?? null);
    if (!m) throw notFound("User not found in this company");
  }

  async function ensureSinglePrimary(
    agentId: string,
    excludeId?: string,
  ): Promise<void> {
    const ex = await db
      .select({ id: humanAgentControls.id })
      .from(humanAgentControls)
      .where(
        and(
          eq(humanAgentControls.agentId, agentId),
          eq(humanAgentControls.isPrimary, true),
        ),
      )
      .then((r) => r[0] ?? null);
    if (ex && ex.id !== excludeId) {
      await db
        .update(humanAgentControls)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(humanAgentControls.id, ex.id));
    }
  }

  return {
    listControls: async (companyId: string, userId?: string) => {
      const conditions = [eq(humanAgentControls.companyId, companyId)];
      if (userId) conditions.push(eq(humanAgentControls.userId, userId));
      return db.select().from(humanAgentControls).where(and(...conditions));
    },

    createControl: async (
      companyId: string,
      userId: string,
      agentId: string,
      isPrimary: boolean,
      permissions: HumanAgentPermissions,
    ) => {
      await ensureUserBelongsToCompany(companyId, userId);
      await ensureAgentBelongsToCompany(companyId, agentId);
      if (isPrimary) await ensureSinglePrimary(agentId);
      try {
        const [row] = await db
          .insert(humanAgentControls)
          .values({ companyId, userId, agentId, isPrimary, permissions })
          .returning();
        return row;
      } catch (err: any) {
        if (err.code === "23505") {
          throw unprocessable(
            "A control relationship already exists between this user and agent",
          );
        }
        throw err;
      }
    },

    updateControl: async (
      companyId: string,
      controlId: string,
      data: { isPrimary?: boolean; permissions?: HumanAgentPermissions },
    ) => {
      const existing = await db
        .select()
        .from(humanAgentControls)
        .where(
          and(
            eq(humanAgentControls.id, controlId),
            eq(humanAgentControls.companyId, companyId),
          ),
        )
        .then((r) => r[0] ?? null);
      if (!existing) throw notFound("Control relationship not found");
      if (data.isPrimary === true) {
        await ensureSinglePrimary(existing.agentId, controlId);
      }
      const [updated] = await db
        .update(humanAgentControls)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(humanAgentControls.id, controlId))
        .returning();
      return updated;
    },

    deleteControl: async (companyId: string, controlId: string) => {
      const deleted = await db
        .delete(humanAgentControls)
        .where(
          and(
            eq(humanAgentControls.id, controlId),
            eq(humanAgentControls.companyId, companyId),
          ),
        )
        .returning()
        .then((r) => r[0] ?? null);
      if (!deleted) throw notFound("Control relationship not found");
      return deleted;
    },

    getControllers: async (companyId: string, agentId: string) => {
      return db
        .select()
        .from(humanAgentControls)
        .where(
          and(
            eq(humanAgentControls.companyId, companyId),
            eq(humanAgentControls.agentId, agentId),
          ),
        );
    },

    findPrimaryController: async (agentId: string) => {
      return db
        .select()
        .from(humanAgentControls)
        .where(
          and(
            eq(humanAgentControls.agentId, agentId),
            eq(humanAgentControls.isPrimary, true),
          ),
        )
        .then((r) => r[0] ?? null);
    },
  };
}
