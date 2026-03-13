import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createLocalAdapterInjection } from "../adapters/local-injection.js";

/**
 * Property 6: Disabled tools excluded from injection
 * Property 7: Local adapter file injection reflects DB state
 *
 * Pure-function tests — the adapter methods are async but have no DB
 * side-effects, so we can await them directly inside fast-check properties.
 *
 * **Validates: Requirements 7.2, 7.4, 3.5**
 */

// ── Generators ──────────────────────────────────────────────────────────────

const adapterTypeArb = fc.constantFrom(
  "claude_local",
  "codex_local",
  "opencode_local",
  "pi_local",
  "cursor",
);

// Use alphanumeric names to avoid JSON escaping edge cases
const safeNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,20}$/);

const toolArb = fc.record({
  id: fc.uuid(),
  name: safeNameArb,
  toolType: fc.constantFrom("mcp", "api", "shell", "builtin"),
  description: fc.option(safeNameArb, { nil: undefined }),
  enabled: fc.boolean(),
  config: fc.record({
    serverUrl: fc.constant("http://example.com"),
  }),
});

const toolListArb = fc.array(toolArb, { minLength: 1, maxLength: 8 });

const soulArb = fc.record({
  systemPrompt: safeNameArb,
  personality: fc.option(safeNameArb, { nil: null }),
  constraints: fc.option(safeNameArb, { nil: null }),
  outputFormat: fc.option(safeNameArb, { nil: null }),
});

const skillArb = fc.record({
  name: safeNameArb,
  content: safeNameArb,
});

const skillListArb = fc.array(skillArb, { minLength: 1, maxLength: 5 });

const memoryArb = fc.record({
  key: safeNameArb,
  value: safeNameArb,
});

const memoryListArb = fc.array(memoryArb, { minLength: 1, maxLength: 5 });

// ── Property 6: Disabled tools excluded from injection ──────────────────────

describe("Property 6: Disabled tools excluded from injection", () => {
  it("disabled tools never appear in prepareTools result", async () => {
    // Generate tools where names are unique so we can distinguish them
    const uniqueToolsArb = toolListArb.filter((tools) => {
      const names = tools.map((t) => t.name);
      return new Set(names).size === names.length;
    });

    await fc.assert(
      fc.asyncProperty(adapterTypeArb, uniqueToolsArb, async (adapterType, tools) => {
        const adapter = createLocalAdapterInjection(adapterType);
        const result = await adapter.prepareTools(tools);

        const disabled = tools.filter((t) => !t.enabled);
        const enabled = tools.filter((t) => t.enabled);

        if (result.type === "noop") {
          // noop means no enabled tools
          expect(enabled.length).toBe(0);
        } else if (result.type === "config") {
          // MCP JSON — check mcpServers keys don't include disabled tool names
          const mcpServers = (result.value as Record<string, unknown>).mcpServers as
            | Record<string, unknown>
            | undefined;
          const keys = mcpServers ? Object.keys(mcpServers) : [];
          for (const tool of disabled) {
            expect(keys).not.toContain(tool.name);
          }
        } else if (result.type === "file") {
          // cursor → markdown; disabled tools should not appear as bold names
          for (const tool of disabled) {
            expect(result.content).not.toContain(`**${tool.name}**`);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("all-disabled tools produce noop result", async () => {
    await fc.assert(
      fc.asyncProperty(adapterTypeArb, toolListArb, async (adapterType, tools) => {
        const allDisabled = tools.map((t) => ({ ...t, enabled: false }));
        const adapter = createLocalAdapterInjection(adapterType);
        const result = await adapter.prepareTools(allDisabled);

        expect(result.type).toBe("noop");
      }),
      { numRuns: 300 },
    );
  });
});


// ── Property 7: Local adapter file injection reflects DB state ──────────────

describe("Property 7: Local adapter file injection reflects DB state", () => {
  it("prepareSoul output contains the systemPrompt from input", async () => {
    await fc.assert(
      fc.asyncProperty(adapterTypeArb, soulArb, async (adapterType, soul) => {
        const adapter = createLocalAdapterInjection(adapterType);
        const result = await adapter.prepareSoul(soul);

        expect(result.type).toBe("file");
        if (result.type === "file") {
          expect(result.content).toContain(soul.systemPrompt);
          if (soul.personality) {
            expect(result.content).toContain(soul.personality);
          }
          if (soul.constraints) {
            expect(result.content).toContain(soul.constraints);
          }
          if (soul.outputFormat) {
            expect(result.content).toContain(soul.outputFormat);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("prepareSkills output contains every skill name and content", async () => {
    await fc.assert(
      fc.asyncProperty(adapterTypeArb, skillListArb, async (adapterType, skills) => {
        const adapter = createLocalAdapterInjection(adapterType);
        const result = await adapter.prepareSkills(skills);

        expect(result.type).toBe("file");
        if (result.type === "file") {
          for (const skill of skills) {
            expect(result.content).toContain(skill.name);
            expect(result.content).toContain(skill.content);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("prepareMemories output contains every memory key and value", async () => {
    await fc.assert(
      fc.asyncProperty(adapterTypeArb, memoryListArb, async (adapterType, memories) => {
        const adapter = createLocalAdapterInjection(adapterType);
        const result = await adapter.prepareMemories(memories);

        expect(result.type).toBe("file");
        if (result.type === "file") {
          for (const mem of memories) {
            expect(result.content).toContain(mem.key);
            expect(result.content).toContain(mem.value);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("prepareTools with enabled MCP tools produces config containing tool names", async () => {
    const mcpToolArb = fc.record({
      id: fc.uuid(),
      name: safeNameArb,
      toolType: fc.constant("mcp" as const),
      description: fc.option(safeNameArb, { nil: undefined }),
      enabled: fc.constant(true),
      config: fc.record({ serverUrl: fc.constant("http://example.com") }),
    });
    const mcpToolListArb = fc.array(mcpToolArb, { minLength: 1, maxLength: 5 }).filter((tools) => {
      const names = tools.map((t) => t.name);
      return new Set(names).size === names.length;
    });

    // Test non-cursor adapters (they produce config type for MCP tools)
    const nonCursorArb = fc.constantFrom(
      "claude_local",
      "codex_local",
      "opencode_local",
      "pi_local",
    );

    await fc.assert(
      fc.asyncProperty(nonCursorArb, mcpToolListArb, async (adapterType, tools) => {
        const adapter = createLocalAdapterInjection(adapterType);
        const result = await adapter.prepareTools(tools);

        expect(result.type).toBe("config");
        if (result.type === "config") {
          const mcpServers = (result.value as Record<string, unknown>).mcpServers as Record<
            string,
            unknown
          >;
          for (const tool of tools) {
            expect(mcpServers).toHaveProperty(tool.name);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("cursor prepareTools with enabled tools produces file containing tool names", async () => {
    const enabledToolArb = fc.record({
      id: fc.uuid(),
      name: safeNameArb,
      toolType: fc.constantFrom("mcp", "api", "shell", "builtin"),
      description: fc.option(safeNameArb, { nil: undefined }),
      enabled: fc.constant(true),
      config: fc.record({ serverUrl: fc.constant("http://example.com") }),
    });
    const enabledToolListArb = fc.array(enabledToolArb, { minLength: 1, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(enabledToolListArb, async (tools) => {
        const adapter = createLocalAdapterInjection("cursor");
        const result = await adapter.prepareTools(tools);

        expect(result.type).toBe("file");
        if (result.type === "file") {
          for (const tool of tools) {
            expect(result.content).toContain(tool.name);
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
