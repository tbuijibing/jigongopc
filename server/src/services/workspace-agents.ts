import { eq, and } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { workspaceAgents, agents, projectWorkspaces } from "@jigongai/db";
import { logActivity, type LogActivityInput } from "./activity-log.js";

export type WorkspaceAgentRole = "lead" | "member" | "observer";

export interface WorkspaceAgentBinding {
  id: string;
  workspaceId: string;
  agentId: string;
  role: WorkspaceAgentRole;
  permissions: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceAgentWithDetails extends WorkspaceAgentBinding {
  agentName: string;
  agentTitle?: string | null;
  workspaceName: string;
  workspaceCwd?: string | null;
  workspaceRepoUrl?: string | null;
}

export interface ActorInfo {
  actorType: "agent" | "user" | "system";
  actorId: string;
}

export function workspaceAgentService(db: Db) {
  return {
    /**
     * List all agents bound to a workspace
     */
    listByWorkspace: async (workspaceId: string): Promise<WorkspaceAgentWithDetails[]> => {
      const bindings = await db
        .select({
          id: workspaceAgents.id,
          workspaceId: workspaceAgents.workspaceId,
          agentId: workspaceAgents.agentId,
          role: workspaceAgents.role,
          permissions: workspaceAgents.permissions,
          createdAt: workspaceAgents.createdAt,
          updatedAt: workspaceAgents.updatedAt,
          agentName: agents.name,
          agentTitle: agents.title,
          workspaceName: projectWorkspaces.name,
          workspaceCwd: projectWorkspaces.cwd,
          workspaceRepoUrl: projectWorkspaces.repoUrl,
        })
        .from(workspaceAgents)
        .innerJoin(agents, eq(workspaceAgents.agentId, agents.id))
        .innerJoin(projectWorkspaces, eq(workspaceAgents.workspaceId, projectWorkspaces.id))
        .where(eq(workspaceAgents.workspaceId, workspaceId))
        .orderBy(agents.name);

      return bindings.map((b) => ({
        id: b.id,
        workspaceId: b.workspaceId,
        agentId: b.agentId,
        role: b.role as WorkspaceAgentRole,
        permissions: b.permissions,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        agentName: b.agentName,
        agentTitle: b.agentTitle,
        workspaceName: b.workspaceName,
        workspaceCwd: b.workspaceCwd,
        workspaceRepoUrl: b.workspaceRepoUrl,
      }));
    },

    /**
     * List all workspaces bound to an agent
     */
    listByAgent: async (agentId: string): Promise<WorkspaceAgentWithDetails[]> => {
      const bindings = await db
        .select({
          id: workspaceAgents.id,
          workspaceId: workspaceAgents.workspaceId,
          agentId: workspaceAgents.agentId,
          role: workspaceAgents.role,
          permissions: workspaceAgents.permissions,
          createdAt: workspaceAgents.createdAt,
          updatedAt: workspaceAgents.updatedAt,
          agentName: agents.name,
          agentTitle: agents.title,
          workspaceName: projectWorkspaces.name,
          workspaceCwd: projectWorkspaces.cwd,
          workspaceRepoUrl: projectWorkspaces.repoUrl,
        })
        .from(workspaceAgents)
        .innerJoin(agents, eq(workspaceAgents.agentId, agents.id))
        .innerJoin(projectWorkspaces, eq(workspaceAgents.workspaceId, projectWorkspaces.id))
        .where(eq(workspaceAgents.agentId, agentId))
        .orderBy(projectWorkspaces.name);

      return bindings.map((b) => ({
        id: b.id,
        workspaceId: b.workspaceId,
        agentId: b.agentId,
        role: b.role as WorkspaceAgentRole,
        permissions: b.permissions,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        agentName: b.agentName,
        agentTitle: b.agentTitle,
        workspaceName: b.workspaceName,
        workspaceCwd: b.workspaceCwd,
        workspaceRepoUrl: b.workspaceRepoUrl,
      }));
    },

    /**
     * Get a specific workspace-agent binding
     */
    getBinding: async (workspaceId: string, agentId: string): Promise<WorkspaceAgentBinding | null> => {
      const results = await db
        .select()
        .from(workspaceAgents)
        .where(and(eq(workspaceAgents.workspaceId, workspaceId), eq(workspaceAgents.agentId, agentId)))
        .limit(1);

      if (results.length === 0) return null;

      const r = results[0];
      return {
        id: r.id,
        workspaceId: r.workspaceId,
        agentId: r.agentId,
        role: r.role as WorkspaceAgentRole,
        permissions: r.permissions,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    },

    /**
     * Add or update an agent binding to a workspace
     */
    addBinding: async (
      workspaceId: string,
      agentId: string,
      role: WorkspaceAgentRole = "member",
      actor?: ActorInfo,
      companyId?: string,
    ): Promise<WorkspaceAgentBinding> => {
      // Check if binding already exists
      const existing = await db
        .select()
        .from(workspaceAgents)
        .where(and(eq(workspaceAgents.workspaceId, workspaceId), eq(workspaceAgents.agentId, agentId)))
        .limit(1);

      let binding: WorkspaceAgentBinding;

      if (existing.length > 0) {
        // Update existing binding
        const updated = await db
          .update(workspaceAgents)
          .set({ role, updatedAt: new Date() })
          .where(and(eq(workspaceAgents.workspaceId, workspaceId), eq(workspaceAgents.agentId, agentId)))
          .returning();

        const r = updated[0];
        binding = {
          id: r.id,
          workspaceId: r.workspaceId,
          agentId: r.agentId,
          role: r.role as WorkspaceAgentRole,
          permissions: r.permissions,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      } else {
        // Create new binding
        const created = await db
          .insert(workspaceAgents)
          .values({
            workspaceId: workspaceId,
            agentId: agentId,
            role: role,
            companyId: companyId!,
          })
          .returning();

        const r = created[0];
        binding = {
          id: r.id,
          workspaceId: r.workspaceId,
          agentId: r.agentId,
          role: r.role as WorkspaceAgentRole,
          permissions: r.permissions,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }

      // Log activity
      if (actor && companyId) {
        const activityInput: LogActivityInput = {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "bind",
          entityType: "workspace_agent",
          entityId: binding.id,
          details: {
            workspaceId,
            agentId,
            role,
          },
        };
        await logActivity(db, activityInput);
      }

      return binding;
    },

    /**
     * Remove an agent binding from a workspace
     */
    removeBinding: async (
      workspaceId: string,
      agentId: string,
      actor?: ActorInfo,
      companyId?: string,
    ): Promise<void> => {
      const existing = await db
        .select()
        .from(workspaceAgents)
        .where(and(eq(workspaceAgents.workspaceId, workspaceId), eq(workspaceAgents.agentId, agentId)))
        .limit(1);

      if (existing.length === 0) {
        throw new Error("Binding not found");
      }

      await db
        .delete(workspaceAgents)
        .where(and(eq(workspaceAgents.workspaceId, workspaceId), eq(workspaceAgents.agentId, agentId)));

      // Log activity
      if (actor && companyId) {
        const activityInput: LogActivityInput = {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "unbind",
          entityType: "workspace_agent",
          entityId: existing[0].id,
          details: {
            workspaceId,
            agentId,
          },
        };
        await logActivity(db, activityInput);
      }
    },

    /**
     * Update the role of an agent in a workspace
     */
    updateRole: async (
      workspaceId: string,
      agentId: string,
      role: WorkspaceAgentRole,
      actor?: ActorInfo,
      companyId?: string,
    ): Promise<WorkspaceAgentBinding> => {
      const updated = await db
        .update(workspaceAgents)
        .set({ role, updatedAt: new Date() })
        .where(and(eq(workspaceAgents.workspaceId, workspaceId), eq(workspaceAgents.agentId, agentId)))
        .returning();

      if (updated.length === 0) {
        throw new Error("Binding not found");
      }

      const r = updated[0];
      const binding: WorkspaceAgentBinding = {
        id: r.id,
        workspaceId: r.workspaceId,
        agentId: r.agentId,
        role: r.role as WorkspaceAgentRole,
        permissions: r.permissions,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };

      // Log activity
      if (actor && companyId) {
        const activityInput: LogActivityInput = {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "update",
          entityType: "workspace_agent",
          entityId: binding.id,
          details: {
            workspaceId,
            agentId,
            role,
          },
        };
        await logActivity(db, activityInput);
      }

      return binding;
    },

    /**
     * Sync workspace-agent bindings (add new, remove missing)
     */
    syncBindings: async (
      workspaceId: string,
      agentIds: string[],
      actor?: ActorInfo,
      companyId?: string,
    ): Promise<WorkspaceAgentBinding[]> => {
      // Get existing bindings
      const existing = await db
        .select()
        .from(workspaceAgents)
        .where(eq(workspaceAgents.workspaceId, workspaceId));

      const existingAgentIds = existing.map((b) => b.agentId);

      // Find agents to add
      const toAdd = agentIds.filter((id) => !existingAgentIds.includes(id));

      // Find agents to remove
      const toRemove = existingAgentIds.filter((id) => !agentIds.includes(id));

      // Add new bindings
      for (const agentId of toAdd) {
        await workspaceAgentService(db).addBinding(workspaceId, agentId, "member", actor, companyId);
      }

      // Remove old bindings
      for (const agentId of toRemove) {
        await workspaceAgentService(db).removeBinding(workspaceId, agentId, actor, companyId);
      }

      // Return updated list
      return (await workspaceAgentService(db).listByWorkspace(workspaceId)).map((b) => ({
        id: b.id,
        workspaceId: b.workspaceId,
        agentId: b.agentId,
        role: b.role,
        permissions: b.permissions,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }));
    },
  };
}
