import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createRemoteAdapterInjection } from "../adapters/remote-injection.js";

/**
 * Property 8: Remote adapter prompt payload contains all dimensions
 *
 * For any remote adapter (openclaw_gateway, http) and any Agent with
 * six-dimension data, the assembled prompt payload SHALL contain sections
 * derived from Soul (system prompt), Skills (instructions), Memory (context),
 * and Tools (tool definitions) — skipping only dimensions the adapter
 * explicitly does not support.
 *
 * **Validates: Requirements 7.3, 7.5, 7.6**
 */

// ── Generators ──────────────────────────────────────────────────────────────

const remoteAdapterTypeArb = fc.constantFrom("openclaw_gateway", "http");

const safeNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,20}$/);

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

// ── Property 8: Remote adapter prompt payload contains all dimensions ───────

describe("Property 8: Remote adapter prompt payload contains all dimensions", () => {
  it("prepareSoul returns prompt containing systemPrompt", async () => {
    await fc.assert(
      fc.asyncProperty(remoteAdapterTypeArb, soulArb, async (adapterType, soul) => {
        const adapter = createRemoteAdapterInjection(adapterType);
        const result = await adapter.prepareSoul(soul);

        expect(result.type).toBe("prompt");
        if (result.type === "prompt") {
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

  it("prepareSkills returns prompt containing all skill names and content", async () => {
    await fc.assert(
      fc.asyncProperty(remoteAdapterTypeArb, skillListArb, async (adapterType, skills) => {
        const adapter = createRemoteAdapterInjection(adapterType);
        const result = await adapter.prepareSkills(skills);

        expect(result.type).toBe("prompt");
        if (result.type === "prompt") {
          for (const skill of skills) {
            expect(result.content).toContain(skill.name);
            expect(result.content).toContain(skill.content);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("prepareMemories returns prompt containing all memory keys and values", async () => {
    await fc.assert(
      fc.asyncProperty(remoteAdapterTypeArb, memoryListArb, async (adapterType, memories) => {
        const adapter = createRemoteAdapterInjection(adapterType);
        const result = await adapter.prepareMemories(memories);

        expect(result.type).toBe("prompt");
        if (result.type === "prompt") {
          for (const mem of memories) {
            expect(result.content).toContain(mem.key);
            expect(result.content).toContain(mem.value);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("prepareTools returns noop (best-effort, not supported)", async () => {
    const toolArb = fc.record({
      id: fc.uuid(),
      name: safeNameArb,
      toolType: fc.constantFrom("mcp", "api", "shell", "builtin"),
      enabled: fc.boolean(),
    });
    const toolListArb = fc.array(toolArb, { minLength: 0, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(remoteAdapterTypeArb, toolListArb, async (adapterType, tools) => {
        const adapter = createRemoteAdapterInjection(adapterType);
        const result = await adapter.prepareTools(tools);

        expect(result.type).toBe("noop");
      }),
      { numRuns: 300 },
    );
  });

  it("all four dimensions together cover soul + skills + memory, tools acknowledged as noop", async () => {
    await fc.assert(
      fc.asyncProperty(
        remoteAdapterTypeArb,
        soulArb,
        skillListArb,
        memoryListArb,
        async (adapterType, soul, skills, memories) => {
          const adapter = createRemoteAdapterInjection(adapterType);

          const [soulResult, skillsResult, memoriesResult, toolsResult] = await Promise.all([
            adapter.prepareSoul(soul),
            adapter.prepareSkills(skills),
            adapter.prepareMemories(memories),
            adapter.prepareTools([]),
          ]);

          // Soul dimension present as prompt
          expect(soulResult.type).toBe("prompt");
          if (soulResult.type === "prompt") {
            expect(soulResult.content).toContain(soul.systemPrompt);
          }

          // Skills dimension present as prompt
          expect(skillsResult.type).toBe("prompt");
          if (skillsResult.type === "prompt") {
            for (const skill of skills) {
              expect(skillsResult.content).toContain(skill.name);
            }
          }

          // Memory dimension present as prompt
          expect(memoriesResult.type).toBe("prompt");
          if (memoriesResult.type === "prompt") {
            for (const mem of memories) {
              expect(memoriesResult.content).toContain(mem.key);
            }
          }

          // Tools dimension acknowledged as noop
          expect(toolsResult.type).toBe("noop");
        },
      ),
      { numRuns: 300 },
    );
  });
});
