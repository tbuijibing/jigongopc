export const API_PREFIX = "/api";

const COMPANY_PREFIX = `${API_PREFIX}/companies/:companyId`;
const AGENT_PREFIX = `${COMPANY_PREFIX}/agents/:agentId`;
const ISSUE_PREFIX = `${COMPANY_PREFIX}/issues/:issueId`;

export const API = {
  health: `${API_PREFIX}/health`,
  companies: `${API_PREFIX}/companies`,
  agents: `${API_PREFIX}/agents`,
  projects: `${API_PREFIX}/projects`,
  issues: `${API_PREFIX}/issues`,
  goals: `${API_PREFIX}/goals`,
  approvals: `${API_PREFIX}/approvals`,
  secrets: `${API_PREFIX}/secrets`,
  costs: `${API_PREFIX}/costs`,
  activity: `${API_PREFIX}/activity`,
  dashboard: `${API_PREFIX}/dashboard`,
  sidebarBadges: `${API_PREFIX}/sidebar-badges`,
  invites: `${API_PREFIX}/invites`,
  joinRequests: `${API_PREFIX}/join-requests`,
  members: `${API_PREFIX}/members`,
  admin: `${API_PREFIX}/admin`,

  // --- Agent Six-Dimension APIs ---

  /** GET/PUT heartbeat config for an agent */
  agentHeartbeatConfig: `${AGENT_PREFIX}/heartbeat-config`,

  /** GET/PUT soul for an agent */
  agentSoul: `${AGENT_PREFIX}/soul`,

  /** GET (list) / POST (create) tools for an agent */
  agentTools: `${AGENT_PREFIX}/tools`,
  /** PUT / DELETE a specific tool */
  agentTool: `${AGENT_PREFIX}/tools/:toolId`,

  /** GET/POST company-level skill registry (skill store) */
  skills: `${COMPANY_PREFIX}/skills`,

  /** GET agent's installed skills */
  agentSkills: `${AGENT_PREFIX}/skills`,
  /** POST install a skill for an agent */
  agentSkillInstall: `${AGENT_PREFIX}/skills/install`,
  /** DELETE uninstall a specific skill from an agent */
  agentSkill: `${AGENT_PREFIX}/skills/:skillId`,

  /** GET (list) / POST (create) memories for an agent */
  agentMemories: `${AGENT_PREFIX}/memories`,
  /** PUT / DELETE a specific memory */
  agentMemory: `${AGENT_PREFIX}/memories/:memoryId`,

  /** GET capabilities matrix for all agents in a company */
  agentCapabilities: `${COMPANY_PREFIX}/agents/capabilities`,
  /** GET discover agents by needs */
  agentDiscover: `${COMPANY_PREFIX}/agents/discover`,

  // --- Issue Extension APIs ---

  /** GET (list) / POST (create) dependencies for an issue */
  issueDependencies: `${ISSUE_PREFIX}/dependencies`,
  /** DELETE a specific dependency */
  issueDependency: `${ISSUE_PREFIX}/dependencies/:depId`,

  /** GET (list) / POST (add) watchers for an issue */
  issueWatchers: `${ISSUE_PREFIX}/watchers`,
  /** DELETE a specific watcher */
  issueWatcher: `${ISSUE_PREFIX}/watchers/:watcherId`,

  // --- Human-Agent Control APIs ---

  /** GET (list) / POST (create) human-agent controls */
  humanAgentControls: `${COMPANY_PREFIX}/human-agent-controls`,
  /** PUT / DELETE a specific control */
  humanAgentControl: `${COMPANY_PREFIX}/human-agent-controls/:controlId`,
  /** GET controllers for a specific agent */
  agentControllers: `${AGENT_PREFIX}/controllers`,

  // --- Agent Self-Service APIs ---

  /** POST (write) / GET (read) agent's own memories */
  agentSelfMemories: `${API_PREFIX}/agent/memories`,
  /** POST install a skill (agent self-service) */
  agentSelfSkillInstall: `${API_PREFIX}/agent/skills/install`,
  /** GET capabilities (agent self-service) */
  agentSelfCapabilities: `${API_PREFIX}/agent/capabilities`,
} as const;
