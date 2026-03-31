import { api } from "./client";

export interface WorkspaceAgentBinding {
  id: string;
  workspaceId: string;
  agentId: string;
  role: "lead" | "member" | "observer";
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

export interface WorkspaceWithAgents {
  id: string;
  name: string;
  agents: WorkspaceAgentWithDetails[];
}

function withCompanyScope(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

export const workspaceAgentsApi = {
  /**
   * List all agents bound to a workspace
   */
  listByWorkspace: (workspaceId: string, companyId?: string) =>
    api.get<WorkspaceAgentWithDetails[]>(withCompanyScope(`/workspaces/${workspaceId}/agents`, companyId)),

  /**
   * List all workspaces bound to an agent
   */
  listByAgent: (agentId: string, companyId?: string) =>
    api.get<WorkspaceWithAgents[]>(withCompanyScope(`/agents/${agentId}/workspaces`, companyId)),

  /**
   * Get a specific workspace-agent binding
   */
  getBinding: (workspaceId: string, agentId: string, companyId?: string) =>
    api.get<WorkspaceAgentBinding>(withCompanyScope(`/workspaces/${workspaceId}/agents/${agentId}`, companyId)),

  /**
   * Add or update an agent binding to a workspace
   */
  addBinding: (
    workspaceId: string,
    agentId: string,
    role: "lead" | "member" | "observer" = "member",
    companyId?: string,
  ) =>
    api.post<WorkspaceAgentBinding>(withCompanyScope(`/workspaces/${workspaceId}/agents`, companyId), {
      agentId,
      role,
    }),

  /**
   * Update the role of an agent in a workspace
   */
  updateRole: (
    workspaceId: string,
    agentId: string,
    role: "lead" | "member" | "observer",
    companyId?: string,
  ) =>
    api.put<WorkspaceAgentBinding>(
      withCompanyScope(`/workspaces/${workspaceId}/agents/${agentId}`, companyId),
      { role },
    ),

  /**
   * Remove an agent from a workspace
   */
  removeBinding: (workspaceId: string, agentId: string, companyId?: string) =>
    api.delete<void>(withCompanyScope(`/workspaces/${workspaceId}/agents/${agentId}`, companyId)),

  /**
   * Sync multiple agent bindings for a workspace
   */
  syncBindings: (
    workspaceId: string,
    bindings: { agentId: string; role: "lead" | "member" | "observer" }[],
    companyId?: string,
  ) =>
    api.post<WorkspaceAgentBinding[]>(withCompanyScope(`/workspaces/${workspaceId}/agents/sync`, companyId), {
      bindings,
    }),
};
