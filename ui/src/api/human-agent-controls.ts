import { api } from "./client";

export interface HumanAgentControl {
  id: string;
  userId: string;
  agentId: string;
  isPrimary: boolean;
  permissions: {
    canWakeup?: boolean;
    canPause?: boolean;
    canTerminate?: boolean;
    canConfigure?: boolean;
    canViewLogs?: boolean;
    canAssignTasks?: boolean;
    canManageMemory?: boolean;
    canInstallSkills?: boolean;
  };
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
}

export interface CreateControlInput {
  userId: string;
  agentId: string;
  isPrimary?: boolean;
  permissions?: HumanAgentControl["permissions"];
}

export const humanAgentControlsApi = {
  listForAgent: (companyId: string, agentId: string) =>
    api.get<HumanAgentControl[]>(`/companies/${companyId}/agents/${agentId}/controllers`),
  create: (companyId: string, data: CreateControlInput) =>
    api.post<HumanAgentControl>(`/companies/${companyId}/human-agent-controls`, data),
  update: (companyId: string, controlId: string, data: Partial<HumanAgentControl>) =>
    api.put<HumanAgentControl>(`/companies/${companyId}/human-agent-controls/${controlId}`, data),
  remove: (companyId: string, controlId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/human-agent-controls/${controlId}`),
};
