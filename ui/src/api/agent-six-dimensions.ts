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
  skillName?: string;
  skillCategory?: string;
  skillSlug?: string;
  skillDescription?: string;
  skillContent?: string;
  skillVersion?: string;
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
  listSkills: async (companyId: string, agentId: string) => {
    const result = await api.get<{ source: string; skills: AgentSkill[] }>(`/companies/${companyId}/agents/${agentId}/skills`);
    return result.skills;
  },
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

  // Template Marketplace
  listMarketplaceTemplates: (companyId: string, params?: {
    category?: string;
    freeOnly?: boolean;
    sort?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.freeOnly) searchParams.set("freeOnly", "true");
    if (params?.sort) searchParams.set("sort", params.sort);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return api.get<{ templates: CompanyTemplate[]; total: number }>(
      `/companies/${companyId}/marketplace/templates?${searchParams.toString()}`
    );
  },

  searchMarketplace: (companyId: string, query: string, params?: {
    category?: string;
    priceMin?: number;
    priceMax?: number;
    rating?: number;
    sort?: string;
  }) => {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.category) searchParams.set("category", params.category);
    if (params?.priceMin !== undefined) searchParams.set("priceMin", String(params.priceMin));
    if (params?.priceMax !== undefined) searchParams.set("priceMax", String(params.priceMax));
    if (params?.rating !== undefined) searchParams.set("rating", String(params.rating));
    if (params?.sort) searchParams.set("sort", params.sort);
    return api.get<{ templates: CompanyTemplate[]; total: number }>(
      `/companies/${companyId}/marketplace/templates/search?${searchParams.toString()}`
    );
  },

  getMarketplaceTemplate: (companyId: string, templateId: string, includeLineage?: boolean) => {
    const params = includeLineage ? "?includeLineage=true" : "";
    return api.get<CompanyTemplateDetail>(`/companies/${companyId}/marketplace/templates/${templateId}${params}`);
  },

  previewTemplate: (companyId: string, templateId: string) =>
    api.get<{ manifest: object; customizationPreview: object }>(
      `/companies/${companyId}/marketplace/templates/${templateId}/preview`
    ),

  purchaseTemplate: (companyId: string, templateId: string, data: { paymentMethod: string }) =>
    api.post<{ success: boolean; transactionId: string; amountCents: number; status: string }>(
      `/companies/${companyId}/marketplace/templates/${templateId}/purchase`,
      data
    ),

  installTemplate: (companyId: string, templateId: string, data: { targetCompanyId: string; customize?: boolean }) =>
    api.post<{ success: boolean; templateId: string; version: string; message?: string }>(
      `/companies/${companyId}/marketplace/templates/${templateId}/install`,
      data
    ),

  forkTemplate: (companyId: string, templateId: string, data: {
    name?: string;
    description?: string;
    priceCents?: number;
    isPublic?: boolean;
  }) =>
    api.post<CompanyTemplate>(
      `/companies/${companyId}/marketplace/templates/${templateId}/fork`,
      data
    ),

  listInstalledTemplates: (companyId: string) =>
    api.get<{ templates: CompanyTemplate[] }>(`/companies/${companyId}/templates/installed`),

  uninstallTemplate: (companyId: string, templateId: string, force?: boolean) =>
    api.post<{ success: boolean }>(`/companies/${companyId}/templates/${templateId}/uninstall`, { force }),

  upgradeTemplate: (companyId: string, templateId: string, targetVersion?: string) =>
    api.post<{ success: boolean; version: string }>(
      `/companies/${companyId}/templates/${templateId}/upgrade`,
      { targetVersion }
    ),

  publishTemplate: (companyId: string, templateId: string, isPublic: boolean) =>
    api.post<CompanyTemplate>(`/companies/${companyId}/templates/${templateId}/publish`, { isPublic }),

  // Creator Revenue
  getCreatorRevenue: (companyId: string) =>
    api.get<CreatorRevenueSummary>(`/companies/${companyId}/creator/revenue`),

  requestPayout: (companyId: string, data: { amountCents: number; method: string }) =>
    api.post<{ success: boolean; payoutId: string }>(`/companies/${companyId}/creator/payout`, data),
};

// Template Marketplace Types
export interface CompanyTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  version: string;
  category?: string;
  isPublic: boolean;
  priceCents: number;
  installCount: number;
  rating?: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyTemplateDetail extends CompanyTemplate {
  content?: object;
  lineage?: {
    forkedFrom?: string;
    forkedFromName?: string;
    ancestorChain: Array<{
      id: string;
      name: string;
      level: number;
    }>;
    forks: Array<{
      id: string;
      name: string;
      companyName: string;
    }>;
  };
  versions: Array<{
    version: string;
    changeLog?: string;
    createdAt: string;
  }>;
}

export interface CreatorRevenueSummary {
  totalEarnedCents: number;
  availableBalanceCents: number;
  pendingBalanceCents: number;
  totalWithdrawnCents: number;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  tierProgress: {
    current: number;
    next: number;
    percentage: number;
  };
  templates: Array<{
    templateId: string;
    name: string;
    totalRevenueCents: number;
    installCount: number;
  }>;
}
