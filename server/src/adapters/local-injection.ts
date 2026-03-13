/**
 * Local adapter context injection implementations.
 *
 * Each local adapter renders Agent six-dimension data (Soul, Skills, Memory,
 * Tools) into files that the underlying CLI tool reads.  The files are a
 * "projection" of the database — regenerated before every heartbeat run.
 *
 * Requirements: 7.2, 7.4
 */

import type {
  AdapterContextInjection,
  AdapterInjectionCapabilities,
  InjectionResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers — render DB rows into text sections
// ---------------------------------------------------------------------------

function renderSoulMarkdown(soul: Record<string, unknown>): string {
  const lines: string[] = [];
  if (soul.systemPrompt) lines.push(String(soul.systemPrompt));
  if (soul.personality) {
    lines.push("", "## Personality", String(soul.personality));
  }
  if (soul.constraints) {
    lines.push("", "## Constraints", String(soul.constraints));
  }
  if (soul.outputFormat) {
    lines.push("", "## Output Format", String(soul.outputFormat));
  }
  return lines.join("\n");
}

function renderSkillsMarkdown(skills: unknown[]): string {
  if (skills.length === 0) return "";
  const lines: string[] = ["## Skills"];
  for (const s of skills) {
    const skill = s as Record<string, unknown>;
    const name = skill.name ?? "Untitled";
    const content = skill.content ?? "";
    lines.push("", `### ${name}`, String(content));
  }
  return lines.join("\n");
}

function renderMemoriesMarkdown(memories: unknown[]): string {
  if (memories.length === 0) return "";
  const lines: string[] = ["## Memory Context"];
  for (const m of memories) {
    const mem = m as Record<string, unknown>;
    lines.push(`- **${mem.key ?? "unknown"}**: ${mem.value ?? ""}`);
  }
  return lines.join("\n");
}

function renderToolsMcpJson(tools: unknown[]): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = {};
  for (const t of tools) {
    const tool = t as Record<string, unknown>;
    if (!tool.enabled) continue;
    const config = (tool.config ?? {}) as Record<string, unknown>;
    const name = String(tool.name ?? `tool-${tool.id ?? "unknown"}`);
    if (tool.toolType === "mcp") {
      mcpServers[name] = {
        url: config.serverUrl ?? config.url ?? "",
        ...(config.transport ? { transport: config.transport } : {}),
      };
    }
  }
  return { mcpServers };
}

function renderToolsMarkdown(tools: unknown[]): string {
  const enabled = (tools as Record<string, unknown>[]).filter((t) => t.enabled);
  if (enabled.length === 0) return "";
  const lines: string[] = ["## Tools"];
  for (const tool of enabled) {
    const desc = tool.description ? ` — ${tool.description}` : "";
    lines.push(`- **${tool.name}** (${tool.toolType})${desc}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// claude_local injection
// ---------------------------------------------------------------------------

class ClaudeLocalInjection implements AdapterContextInjection {
  getCapabilities(): AdapterInjectionCapabilities {
    return {
      supportsSoulInjection: true,
      supportsSkillInjection: true,
      supportsMemoryInjection: true,
      supportsToolInjection: true,
    };
  }

  async prepareSoul(soul: unknown): Promise<InjectionResult> {
    if (!soul) return { type: "noop", reason: "no soul data" };
    const content = renderSoulMarkdown(soul as Record<string, unknown>);
    return { type: "file", path: "CLAUDE.md", content };
  }

  async prepareSkills(skills: unknown[]): Promise<InjectionResult> {
    if (skills.length === 0) return { type: "noop", reason: "no skills" };
    const content = renderSkillsMarkdown(skills);
    return { type: "file", path: "skills/agent-skills.md", content };
  }

  async prepareMemories(memories: unknown[]): Promise<InjectionResult> {
    if (memories.length === 0) return { type: "noop", reason: "no memories" };
    const content = renderMemoriesMarkdown(memories);
    return { type: "file", path: "CLAUDE.md", content };
  }

  async prepareTools(tools: unknown[]): Promise<InjectionResult> {
    const enabled = (tools as Record<string, unknown>[]).filter((t) => t.enabled);
    if (enabled.length === 0) return { type: "noop", reason: "no enabled tools" };
    const value = renderToolsMcpJson(enabled);
    return { type: "config", key: ".mcp.json", value };
  }
}

// ---------------------------------------------------------------------------
// codex_local / opencode_local / pi_local injection (AGENTS.md based)
// ---------------------------------------------------------------------------

class AgentsMdInjection implements AdapterContextInjection {
  getCapabilities(): AdapterInjectionCapabilities {
    return {
      supportsSoulInjection: true,
      supportsSkillInjection: true,
      supportsMemoryInjection: true,
      supportsToolInjection: true,
    };
  }

  async prepareSoul(soul: unknown): Promise<InjectionResult> {
    if (!soul) return { type: "noop", reason: "no soul data" };
    const content = renderSoulMarkdown(soul as Record<string, unknown>);
    return { type: "file", path: "AGENTS.md", content };
  }

  async prepareSkills(skills: unknown[]): Promise<InjectionResult> {
    if (skills.length === 0) return { type: "noop", reason: "no skills" };
    const content = renderSkillsMarkdown(skills);
    return { type: "file", path: "AGENTS.md", content };
  }

  async prepareMemories(memories: unknown[]): Promise<InjectionResult> {
    if (memories.length === 0) return { type: "noop", reason: "no memories" };
    const content = renderMemoriesMarkdown(memories);
    return { type: "file", path: "AGENTS.md", content };
  }

  async prepareTools(tools: unknown[]): Promise<InjectionResult> {
    const enabled = (tools as Record<string, unknown>[]).filter((t) => t.enabled);
    if (enabled.length === 0) return { type: "noop", reason: "no enabled tools" };
    const value = renderToolsMcpJson(enabled);
    return { type: "config", key: ".mcp.json", value };
  }
}

// ---------------------------------------------------------------------------
// cursor injection (.cursorrules based)
// ---------------------------------------------------------------------------

class CursorInjection implements AdapterContextInjection {
  getCapabilities(): AdapterInjectionCapabilities {
    return {
      supportsSoulInjection: true,
      supportsSkillInjection: true,
      supportsMemoryInjection: true,
      supportsToolInjection: true,
    };
  }

  async prepareSoul(soul: unknown): Promise<InjectionResult> {
    if (!soul) return { type: "noop", reason: "no soul data" };
    const content = renderSoulMarkdown(soul as Record<string, unknown>);
    return { type: "file", path: ".cursorrules", content };
  }

  async prepareSkills(skills: unknown[]): Promise<InjectionResult> {
    if (skills.length === 0) return { type: "noop", reason: "no skills" };
    const content = renderSkillsMarkdown(skills);
    return { type: "file", path: ".cursorrules", content };
  }

  async prepareMemories(memories: unknown[]): Promise<InjectionResult> {
    if (memories.length === 0) return { type: "noop", reason: "no memories" };
    const content = renderMemoriesMarkdown(memories);
    return { type: "file", path: ".cursorrules", content };
  }

  async prepareTools(tools: unknown[]): Promise<InjectionResult> {
    const enabled = (tools as Record<string, unknown>[]).filter((t) => t.enabled);
    if (enabled.length === 0) return { type: "noop", reason: "no enabled tools" };
    const content = renderToolsMarkdown(enabled);
    return { type: "file", path: ".cursorrules", content };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const LOCAL_ADAPTER_TYPES = new Set([
  "claude_local",
  "codex_local",
  "opencode_local",
  "pi_local",
  "cursor",
]);

/**
 * Create an AdapterContextInjection for a local adapter type.
 *
 * @throws if the adapter type is not a recognised local adapter.
 */
export function createLocalAdapterInjection(
  adapterType: string,
): AdapterContextInjection {
  switch (adapterType) {
    case "claude_local":
      return new ClaudeLocalInjection();
    case "codex_local":
    case "opencode_local":
    case "pi_local":
      return new AgentsMdInjection();
    case "cursor":
      return new CursorInjection();
    default:
      throw new Error(
        `Unsupported local adapter type: ${adapterType}. ` +
          `Supported: ${[...LOCAL_ADAPTER_TYPES].join(", ")}`,
      );
  }
}

/** Check whether an adapter type is a local adapter. */
export function isLocalAdapter(adapterType: string): boolean {
  return LOCAL_ADAPTER_TYPES.has(adapterType);
}
