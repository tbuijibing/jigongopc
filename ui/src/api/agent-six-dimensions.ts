import { api } from "./client";

// ---------------------------------------------------------------------------
// Types — mirror backend DB schema
// ---------------------------------------------------------------------------

export interface HeartbeatConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  intervalSec: number;
  wakeOnAssignment: boolean;
  wakeOnMention: boolean;
  wakeOnDemand: boolean;
  maxConcurrentRuns: number;
  timeoutSec: number;
  cooldownSec: number;
}

export interface Soul {
  id: string;
  agentId: string;
  systemPrompt: string;
  personality: string | null;
  constraints: string | null;
  outputFormat: string | null;
  language: string;
  version: number;
}

export interface AgentTool {
  id: string;
  agentId: string;
  toolType: "mcp" | "api" | "shell" | "builtin";
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface SkillRegistryEntry {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  content: string;
  category: string;
  version: string;
  author: string | null;
  isBuiltin: boolean;
}

export interface AgentSkill {
  id: string;
  agentId: string;
  skillId: string;
  installType: string;
  enabled: boolean;
  installedAt: string;
  name?: string;
  category?: string;
}

export interface AgentMemory {
  id: string;
  agentId: string;
  memoryLayer: "agent" | "project" | "task";
  scopeId: string | null;
  key: string;
  value: string;
  memoryType: "fact" | "preference" | "learning" | "context";
  importance: number;
  accessCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface AgentCapabilities {
  languages: string[];
  frameworks: string[];
  domains: string[];
  tools: string[];
  customTags: string[];
}

export interface DiscoverResult {
  agent: { id: string; name: string; role: string };
  matchedCapabilities: string[];
}

// ---------------------------------------------------------------------------
// Input types for create / update operations
// ---------------------------------------------------------------------------

export interface CreateToolInput {
  toolType: AgentTool["toolType"];
  name: string;
  description?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface CreateSkillInput {
  name: string;
  slug: string;
  description?: string;
  content: string;
  category: string;
  version?: string;
  author?: string;
}

export interface CreateMemoryInput {
  key: string;
  value: string;
  memoryLayer: AgentMemory["memoryLayer"];
  scopeId?: string;
  memoryType?: AgentMemory["memoryType"];
  importance?: number;
  expiresAt?: string | null;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const agentSixDimensionApi = {
  // Heartbeat Config
  getHeartbeatConfig: (companyId: string, agentId: string) =>
    api.get<HeartbeatConfig>(`/companies/${companyId}/agents/${agentId}/heartbeat-config`),
  updateHeartbeatConfig: (companyId: string, agentId: string, data: Partial<HeartbeatConfig>) =>
    api.put<HeartbeatConfig>(`/companies/${companyId}/agents/${agentId}/heartbeat-config`, data),

  // Soul
  getSoul: (companyId: string, agentId: string) =>
    api.get<Soul>(`/companies/${companyId}/agents/${agentId}/soul`),
  updateSoul: (companyId: string, agentId: string, data: Partial<Soul>) =>
    api.put<Soul>(`/companies/${companyId}/agents/${agentId}/soul`, data),

  // Tools
  listTools: (companyId: string, agentId: string) =>
    api.get<AgentTool[]>(`/companies/${companyId}/agents/${agentId}/tools`),
  createTool: (companyId: string, agentId: string, data: CreateToolInput) =>
    api.post<AgentTool>(`/companies/${companyId}/agents/${agentId}/tools`, data),
  updateTool: (companyId: string, agentId: string, toolId: string, data: Partial<AgentTool>) =>
    api.put<AgentTool>(`/companies/${companyId}/agents/${agentId}/tools/${toolId}`, data),
  deleteTool: (companyId: string, agentId: string, toolId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/agents/${agentId}/tools/${toolId}`),

  // Skills (agent-level)
  listSkills: (companyId: string, agentId: string) =>
    api.get<AgentSkill[]>(`/companies/${companyId}/agents/${agentId}/skills`),
  installSkill: (companyId: string, agentId: string, data: { skillId: string }) =>
    api.post<AgentSkill>(`/companies/${companyId}/agents/${agentId}/skills/install`, data),
  uninstallSkill: (companyId: string, agentId: string, skillId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/agents/${agentId}/skills/${skillId}`),

  // Skills (company-level skill store)
  listSkillStore: (companyId: string) =>
    api.get<SkillRegistryEntry[]>(`/companies/${companyId}/skills`),
  registerSkill: (companyId: string, data: CreateSkillInput) =>
    api.post<SkillRegistryEntry>(`/companies/${companyId}/skills`, data),

  // Memories
  listMemories: (companyId: string, agentId: string, layer?: string) =>
    api.get<AgentMemory[]>(
      `/companies/${companyId}/agents/${agentId}/memories${layer ? `?layer=${layer}` : ""}`,
    ),
  createMemory: (companyId: string, agentId: string, data: CreateMemoryInput) =>
    api.post<AgentMemory>(`/companies/${companyId}/agents/${agentId}/memories`, data),
  updateMemory: (companyId: string, agentId: string, memoryId: string, data: Partial<AgentMemory>) =>
    api.put<AgentMemory>(`/companies/${companyId}/agents/${agentId}/memories/${memoryId}`, data),
  deleteMemory: (companyId: string, agentId: string, memoryId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/agents/${agentId}/memories/${memoryId}`),

  // Capabilities & Discover
  getCapabilities: (companyId: string) =>
    api.get<AgentCapabilities[]>(`/companies/${companyId}/agents/capabilities`),
  discover: (companyId: string, need: string) =>
    api.get<DiscoverResult[]>(
      `/companies/${companyId}/agents/discover?need=${encodeURIComponent(need)}`,
    ),
};
