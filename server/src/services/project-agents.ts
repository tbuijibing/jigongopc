import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { projectAgents, agents } from "@jigongai/db";
import { logActivity, type LogActivityInput } from "./activity-log.js";

export type ProjectAgentRole = "lead" | "member" | "observer";

export interface ProjectAgentBinding {
  id: string;
  projectId: string;
  agentId: string;
  role: ProjectAgentRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectAgentWithDetails extends ProjectAgentBinding {
  agentName: string;
  agentTitle?: string | null;
}

interface ActorInfo {
  actorType: "agent" | "user" | "system";
  actorId: string;
  agentId?: string | null;
}

export function projectAgentService(db: Db) {
  return {
    /**
     * List all agent bindings for a project
     */
    async listByProject(projectId: string): Promise<ProjectAgentWithDetails[]> {
      const rows = await db
        .select({
          id: projectAgents.id,
          projectId: projectAgents.projectId,
          agentId: projectAgents.agentId,
          role: projectAgents.role,
          createdAt: projectAgents.createdAt,
          updatedAt: projectAgents.updatedAt,
          agentName: agents.name,
          agentTitle: agents.title,
        })
        .from(projectAgents)
        .innerJoin(agents, eq(projectAgents.agentId, agents.id))
        .where(eq(projectAgents.projectId, projectId));

      return rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        agentId: row.agentId,
        role: row.role as ProjectAgentRole,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        agentName: row.agentName,
        agentTitle: row.agentTitle,
      }));
    },

    /**
     * List all project bindings for an agent
     */
    async listByAgent(agentId: string): Promise<ProjectAgentBinding[]> {
      const rows = await db
        .select()
        .from(projectAgents)
        .where(eq(projectAgents.agentId, agentId));

      return rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        agentId: row.agentId,
        role: row.role as ProjectAgentRole,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },

    /**
     * Get a specific binding
     */
    async getBinding(projectId: string, agentId: string): Promise<ProjectAgentBinding | null> {
      const row = await db
        .select()
        .from(projectAgents)
        .where(and(eq(projectAgents.projectId, projectId), eq(projectAgents.agentId, agentId)))
        .then((rows) => rows[0] ?? null);

      if (!row) return null;

      return {
        id: row.id,
        projectId: row.projectId,
        agentId: row.agentId,
        role: row.role as ProjectAgentRole,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    /**
     * Add an agent to a project
     */
    async addBinding(
      projectId: string,
      agentId: string,
      role: ProjectAgentRole = "member",
      actor?: ActorInfo,
      companyId?: string,
    ): Promise<ProjectAgentBinding> {
      // Check if binding already exists
      const existing = await this.getBinding(projectId, agentId);
      if (existing) {
        // Update existing binding
        const [updated] = await db
          .update(projectAgents)
          .set({ role, updatedAt: new Date() })
          .where(and(eq(projectAgents.projectId, projectId), eq(projectAgents.agentId, agentId)))
          .returning();

        if (actor && companyId) {
          await logActivity(db, {
            companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            action: "project_agent.updated",
            entityType: "project_agent",
            entityId: updated.id,
            details: { projectId, agentId, role },
          });
        }

        return {
          id: updated.id,
          projectId: updated.projectId,
          agentId: updated.agentId,
          role: updated.role as ProjectAgentRole,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      }

      // Create new binding
      const [created] = await db
        .insert(projectAgents)
        .values({
          projectId,
          agentId,
          role,
        })
        .returning();

      if (actor && companyId) {
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          action: "project_agent.added",
          entityType: "project_agent",
          entityId: created.id,
          details: { projectId, agentId, role },
        });
      }

      return {
        id: created.id,
        projectId: created.projectId,
        agentId: created.agentId,
        role: created.role as ProjectAgentRole,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    },

    /**
     * Remove an agent from a project
     */
    async removeBinding(
      projectId: string,
      agentId: string,
      actor?: ActorInfo,
      companyId?: string,
    ): Promise<void> {
      const existing = await this.getBinding(projectId, agentId);
      if (!existing) return;

      await db
        .delete(projectAgents)
        .where(and(eq(projectAgents.projectId, projectId), eq(projectAgents.agentId, agentId)));

      if (actor && companyId) {
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          action: "project_agent.removed",
          entityType: "project_agent",
          entityId: existing.id,
          details: { projectId, agentId },
        });
      }
    },

    /**
     * Update the role of an agent in a project
     */
    async updateRole(
      projectId: string,
      agentId: string,
      role: ProjectAgentRole,
      actor?: ActorInfo,
      companyId?: string,
    ): Promise<ProjectAgentBinding | null> {
      const [updated] = await db
        .update(projectAgents)
        .set({ role, updatedAt: new Date() })
        .where(and(eq(projectAgents.projectId, projectId), eq(projectAgents.agentId, agentId)))
        .returning();

      if (!updated) return null;

      if (actor && companyId) {
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          action: "project_agent.role_changed",
          entityType: "project_agent",
          entityId: updated.id,
          details: { projectId, agentId, role },
        });
      }

      return {
        id: updated.id,
        projectId: updated.projectId,
        agentId: updated.agentId,
        role: updated.role as ProjectAgentRole,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    },

    /**
     * Batch add/update bindings for a project
     */
    async syncBindings(
      projectId: string,
      bindings: { agentId: string; role?: ProjectAgentRole }[],
      actor?: ActorInfo,
      companyId?: string,
    ): Promise<ProjectAgentBinding[]> {
      const result: ProjectAgentBinding[] = [];

      for (const binding of bindings) {
        const created = await this.addBinding(
          projectId,
          binding.agentId,
          binding.role ?? "member",
          actor,
          companyId,
        );
        result.push(created);
      }

      return result;
    },
  };
}
