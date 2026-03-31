import { api } from "./client";

export interface ProjectAgentBinding {
  id: string;
  projectId: string;
  agentId: string;
  role: "lead" | "member" | "observer";
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectAgentWithDetails extends ProjectAgentBinding {
  agentName: string;
  agentTitle?: string | null;
}

export interface ProjectWithAgents {
  id: string;
  name: string;
  agents: ProjectAgentWithDetails[];
}

function withCompanyScope(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

export const projectAgentsApi = {
  /**
   * List all agents bound to a project
   */
  listByProject: (projectId: string, companyId?: string) =>
    api.get<ProjectAgentWithDetails[]>(withCompanyScope(`/projects/${projectId}/agents`, companyId)),

  /**
   * List all projects bound to an agent
   */
  listByAgent: (agentId: string, companyId?: string) =>
    api.get<ProjectWithAgents[]>(withCompanyScope(`/agents/${agentId}/projects`, companyId)),

  /**
   * Get a specific project-agent binding
   */
  getBinding: (projectId: string, agentId: string, companyId?: string) =>
    api.get<ProjectAgentBinding>(withCompanyScope(`/projects/${projectId}/agents/${agentId}`, companyId)),

  /**
   * Add or update an agent binding to a project
   */
  addBinding: (projectId: string, agentId: string, role: "lead" | "member" | "observer" = "member", companyId?: string) =>
    api.post<ProjectAgentBinding>(withCompanyScope(`/projects/${projectId}/agents`, companyId), {
      agentId,
      role,
    }),

  /**
   * Update the role of an agent in a project
   */
  updateRole: (projectId: string, agentId: string, role: "lead" | "member" | "observer", companyId?: string) =>
    api.put<ProjectAgentBinding>(
      withCompanyScope(`/projects/${projectId}/agents/${agentId}`, companyId),
      { role },
    ),

  /**
   * Remove an agent from a project
   */
  removeBinding: (projectId: string, agentId: string, companyId?: string) =>
    api.delete<void>(withCompanyScope(`/projects/${projectId}/agents/${agentId}`, companyId)),

  /**
   * Sync multiple agent bindings for a project
   */
  syncBindings: (
    projectId: string,
    bindings: { agentId: string; role: "lead" | "member" | "observer" }[],
    companyId?: string,
  ) =>
    api.post<ProjectAgentBinding[]>(withCompanyScope(`/projects/${projectId}/agents/sync`, companyId), {
      bindings,
    }),
};
