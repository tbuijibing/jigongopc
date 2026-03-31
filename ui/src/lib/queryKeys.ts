export const queryKeys = {
  companies: {
    all: ["companies"] as const,
    detail: (id: string) => ["companies", id] as const,
    stats: ["companies", "stats"] as const,
  },
  agents: {
    list: (companyId: string) => ["agents", companyId] as const,
    detail: (id: string) => ["agents", "detail", id] as const,
    runtimeState: (id: string) => ["agents", "runtime-state", id] as const,
    taskSessions: (id: string) => ["agents", "task-sessions", id] as const,
    keys: (agentId: string) => ["agents", "keys", agentId] as const,
    configRevisions: (agentId: string) => ["agents", "config-revisions", agentId] as const,
    adapterModels: (companyId: string, adapterType: string) =>
      ["agents", companyId, "adapter-models", adapterType] as const,
    heartbeatConfig: (agentId: string) => ["agents", "heartbeat-config", agentId] as const,
    soul: (agentId: string) => ["agents", "soul", agentId] as const,
    tools: (agentId: string) => ["agents", "tools", agentId] as const,
    skills: (agentId: string) => ["agents", "skills", agentId] as const,
    memories: (agentId: string) => ["agents", "memories", agentId] as const,
    capabilities: (companyId: string) => ["agents", "capabilities", companyId] as const,
    discover: (companyId: string, need: string) => ["agents", "discover", companyId, need] as const,
    controllers: (agentId: string) => ["agents", "controllers", agentId] as const,
  },
  issues: {
    list: (companyId: string) => ["issues", companyId] as const,
    search: (companyId: string, q: string, projectId?: string) =>
      ["issues", companyId, "search", q, projectId ?? "__all-projects__"] as const,
    listAssignedToMe: (companyId: string) => ["issues", companyId, "assigned-to-me"] as const,
    listTouchedByMe: (companyId: string) => ["issues", companyId, "touched-by-me"] as const,
    listUnreadTouchedByMe: (companyId: string) => ["issues", companyId, "unread-touched-by-me"] as const,
    labels: (companyId: string) => ["issues", companyId, "labels"] as const,
    listByProject: (companyId: string, projectId: string) =>
      ["issues", companyId, "project", projectId] as const,
    detail: (id: string) => ["issues", "detail", id] as const,
    comments: (issueId: string) => ["issues", "comments", issueId] as const,
    attachments: (issueId: string) => ["issues", "attachments", issueId] as const,
    activity: (issueId: string) => ["issues", "activity", issueId] as const,
    runs: (issueId: string) => ["issues", "runs", issueId] as const,
    approvals: (issueId: string) => ["issues", "approvals", issueId] as const,
    liveRuns: (issueId: string) => ["issues", "live-runs", issueId] as const,
    activeRun: (issueId: string) => ["issues", "active-run", issueId] as const,
    dependencies: (issueId: string) => ["issues", "dependencies", issueId] as const,
    watchers: (issueId: string) => ["issues", "watchers", issueId] as const,
  },
  projects: {
    list: (companyId: string) => ["projects", companyId] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  projectAgents: {
    list: (projectId: string) => ["project-agents", projectId] as const,
    detail: (projectId: string, agentId: string) => ["project-agents", projectId, agentId] as const,
  },
  workspaceAgents: {
    list: (workspaceId: string) => ["workspace-agents", workspaceId] as const,
    detail: (workspaceId: string, agentId: string) => ["workspace-agents", workspaceId, agentId] as const,
  },
  goals: {
    list: (companyId: string) => ["goals", companyId] as const,
    detail: (id: string) => ["goals", "detail", id] as const,
  },
  approvals: {
    list: (companyId: string, status?: string) =>
      ["approvals", companyId, status] as const,
    detail: (approvalId: string) => ["approvals", "detail", approvalId] as const,
    comments: (approvalId: string) => ["approvals", "comments", approvalId] as const,
    issues: (approvalId: string) => ["approvals", "issues", approvalId] as const,
  },
  members: {
    list: (companyId: string) => ["members", companyId] as const,
  },
  access: {
    joinRequests: (companyId: string, status: string = "pending_approval") =>
      ["access", "join-requests", companyId, status] as const,
    invite: (token: string) => ["access", "invite", token] as const,
  },
  auth: {
    session: ["auth", "session"] as const,
  },
  users: {
    me: ["users", "me"] as const,
    detail: (id: string) => ["users", id] as const,
  },
  health: ["health"] as const,
  secrets: {
    list: (companyId: string) => ["secrets", companyId] as const,
    providers: (companyId: string) => ["secret-providers", companyId] as const,
  },
  dashboard: (companyId: string) => ["dashboard", companyId] as const,
  sidebarBadges: (companyId: string) => ["sidebar-badges", companyId] as const,
  activity: (companyId: string) => ["activity", companyId] as const,
  costs: (companyId: string, from?: string, to?: string) =>
    ["costs", companyId, from, to] as const,
  heartbeats: (companyId: string, agentId?: string) =>
    ["heartbeats", companyId, agentId] as const,
  liveRuns: (companyId: string) => ["live-runs", companyId] as const,
  runIssues: (runId: string) => ["run-issues", runId] as const,
  org: (companyId: string) => ["org", companyId] as const,
  collaboration: {
    preferences: (companyId: string) => ["collaboration", "preferences", companyId] as const,
    notifications: (companyId: string) => ["collaboration", "notifications", companyId] as const,
    unreadCount: (companyId: string) => ["collaboration", "unread-count", companyId] as const,
    presence: (companyId: string) => ["collaboration", "presence", companyId] as const,
    dictionaries: (companyId: string, locale: string) => ["collaboration", "dictionaries", companyId, locale] as const,
  },
  skillStore: (companyId: string) => ["skill-store", companyId] as const,
  templates: {
    marketplace: (companyId: string, params?: Record<string, unknown>) =>
      ["templates", "marketplace", companyId, params] as const,
    search: (companyId: string, query: string, params?: Record<string, unknown>) =>
      ["templates", "search", companyId, query, params] as const,
    detail: (companyId: string, templateId: string) =>
      ["templates", "detail", companyId, templateId] as const,
    installed: (companyId: string) => ["templates", "installed", companyId] as const,
    lineage: (companyId: string, templateId: string) =>
      ["templates", "lineage", companyId, templateId] as const,
    creatorRevenue: (companyId: string) => ["templates", "creator-revenue", companyId] as const,
  },
  companySkills: {
    list: (companyId: string) => ["company-skills", companyId] as const,
    detail: (companyId: string, skillId: string) => ["company-skills", companyId, skillId] as const,
  },
  routines: {
    list: (companyId: string) => ["routines", companyId] as const,
    detail: (companyId: string, routineId: string) => ["routines", companyId, routineId] as const,
    runs: (companyId: string, routineId: string) => ["routines", companyId, routineId, "runs"] as const,
  },
  plugins: {
    list: (companyId: string) => ["plugins", companyId] as const,
    detail: (companyId: string, pluginId: string) => ["plugins", companyId, pluginId] as const,
  },
};
