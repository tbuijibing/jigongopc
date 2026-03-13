/**
 * Remote adapter context injection implementations.
 *
 * Remote adapters (openclaw_gateway, http) inject Agent six-dimension data
 * via prompt payloads rather than local files.  Soul, Skills, and Memory are
 * assembled into prompt text sections.  Tool injection is best-effort — remote
 * gateways may not support arbitrary tool definitions, so prepareTools returns
 * a noop with a warning log.
 *
 * Requirements: 7.3, 7.5
 */

import type {
  AdapterContextInjection,
  AdapterInjectionCapabilities,
  InjectionResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers — render DB rows into prompt text
// ---------------------------------------------------------------------------

function renderSoulPrompt(soul: Record<string, unknown>): string {
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

function renderSkillsPrompt(skills: unknown[]): string {
  const lines: string[] = ["## Skills"];
  for (const s of skills) {
    const skill = s as Record<string, unknown>;
    const name = skill.name ?? "Untitled";
    const content = skill.content ?? "";
    lines.push("", `### ${name}`, String(content));
  }
  return lines.join("\n");
}

function renderMemoriesPrompt(memories: unknown[]): string {
  const lines: string[] = ["## Memory Context"];
  for (const m of memories) {
    const mem = m as Record<string, unknown>;
    lines.push(`- **${mem.key ?? "unknown"}**: ${mem.value ?? ""}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Remote adapter injection (openclaw_gateway & http)
// ---------------------------------------------------------------------------

class RemoteAdapterInjection implements AdapterContextInjection {
  getCapabilities(): AdapterInjectionCapabilities {
    return {
      supportsSoulInjection: true,
      supportsSkillInjection: true,
      supportsMemoryInjection: true,
      supportsToolInjection: false,
    };
  }

  async prepareSoul(soul: unknown): Promise<InjectionResult> {
    if (!soul) return { type: "noop", reason: "no soul data" };
    const content = renderSoulPrompt(soul as Record<string, unknown>);
    return { type: "prompt", content };
  }

  async prepareSkills(skills: unknown[]): Promise<InjectionResult> {
    if (skills.length === 0) return { type: "noop", reason: "no skills" };
    const content = renderSkillsPrompt(skills);
    return { type: "prompt", content };
  }

  async prepareMemories(memories: unknown[]): Promise<InjectionResult> {
    if (memories.length === 0) return { type: "noop", reason: "no memories" };
    const content = renderMemoriesPrompt(memories);
    return { type: "prompt", content };
  }

  async prepareTools(_tools: unknown[]): Promise<InjectionResult> {
    console.warn(
      "[remote-injection] Tool injection is best-effort for remote adapters — skipping.",
    );
    return {
      type: "noop",
      reason: "remote adapters have limited tool injection support",
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const REMOTE_ADAPTER_TYPES = new Set(["openclaw_gateway", "http"]);

/**
 * Create an AdapterContextInjection for a remote adapter type.
 *
 * @throws if the adapter type is not a recognised remote adapter.
 */
export function createRemoteAdapterInjection(
  adapterType: string,
): AdapterContextInjection {
  if (!REMOTE_ADAPTER_TYPES.has(adapterType)) {
    throw new Error(
      `Unsupported remote adapter type: ${adapterType}. ` +
        `Supported: ${[...REMOTE_ADAPTER_TYPES].join(", ")}`,
    );
  }
  return new RemoteAdapterInjection();
}

/** Check whether an adapter type is a remote adapter. */
export function isRemoteAdapter(adapterType: string): boolean {
  return REMOTE_ADAPTER_TYPES.has(adapterType);
}
