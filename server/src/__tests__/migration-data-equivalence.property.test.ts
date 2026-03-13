import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 22: Migration data equivalence
 *
 * For any Agent with legacy data (adapterConfig.promptTemplate, runtimeConfig
 * scheduling fields, capabilities text), after migration the corresponding new
 * table records SHALL contain equivalent data. The legacy fields SHALL remain
 * unchanged for fallback purposes.
 *
 * Pure-function model (no DB). We extract the pure parsing/extraction logic
 * from the migration scripts and verify equivalence + immutability.
 *
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4**
 */

// ── Pure extraction functions (mirroring migration script logic) ────────────

/**
 * Extracts systemPrompt from adapterConfig.promptTemplate.
 * Mirrors: migrate-souls.ts
 */
function extractSoul(adapterConfig: Record<string, unknown>): { systemPrompt: string; version: number } | null {
  if (typeof adapterConfig.promptTemplate !== "string") return null;
  const promptTemplate = adapterConfig.promptTemplate as string;
  if (!promptTemplate) return null;
  return { systemPrompt: promptTemplate, version: 1 };
}

/**
 * Extracts heartbeat config fields from runtimeConfig.heartbeat.
 * Mirrors: migrate-heartbeats.ts
 */
function extractHeartbeat(runtimeConfig: Record<string, unknown>): {
  enabled: boolean;
  intervalSec: number;
  wakeOnAssignment: boolean;
  wakeOnMention: boolean;
  wakeOnDemand: boolean;
  maxConcurrentRuns: number;
  timeoutSec: number;
  cooldownSec: number;
} | null {
  const heartbeat = runtimeConfig.heartbeat;
  if (typeof heartbeat !== "object" || heartbeat === null || Array.isArray(heartbeat)) return null;
  const hb = heartbeat as Record<string, unknown>;
  return {
    enabled: toBool(hb.enabled, true),
    intervalSec: toInt(hb.intervalSec, 300),
    wakeOnAssignment: toBool(hb.wakeOnAssignment, true),
    wakeOnMention: toBool(hb.wakeOnMention, true),
    wakeOnDemand: toBool(hb.wakeOnDemand ?? hb.wakeOnAssignment ?? hb.wakeOnOnDemand ?? hb.wakeOnAutomation, true),
    maxConcurrentRuns: toInt(hb.maxConcurrentRuns, 1),
    timeoutSec: toInt(hb.timeoutSec, 600),
    cooldownSec: toInt(hb.cooldownSec, 60),
  };
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function toInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  return fallback;
}

/**
 * Parses capabilities into structured format.
 * Mirrors: migrate-capabilities.ts parseToStructured
 */
function parseCapabilities(raw: unknown): {
  languages: string[];
  frameworks: string[];
  domains: string[];
  tools: string[];
  customTags: string[];
} {
  const empty = { languages: [] as string[], frameworks: [] as string[], domains: [] as string[], tools: [] as string[], customTags: [] as string[] };

  if (typeof raw === "string") {
    const tags = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return { ...empty, customTags: tags.length > 0 ? tags : [raw].filter(Boolean) };
  }

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const result = { ...empty };
    for (const key of ["languages", "frameworks", "domains", "tools", "customTags"] as const) {
      if (Array.isArray(obj[key])) {
        result[key] = (obj[key] as unknown[]).map(String);
      }
    }
    return result;
  }

  const fallback = String(raw);
  return { ...empty, customTags: fallback ? [fallback] : [] };
}

/**
 * Checks if capabilities are already in structured format.
 * Mirrors: migrate-capabilities.ts skip check
 */
function isAlreadyStructured(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    Array.isArray((raw as Record<string, unknown>).languages) &&
    Array.isArray((raw as Record<string, unknown>).frameworks) &&
    Array.isArray((raw as Record<string, unknown>).domains) &&
    Array.isArray((raw as Record<string, unknown>).tools) &&
    Array.isArray((raw as Record<string, unknown>).customTags)
  );
}

// ── Generators ──────────────────────────────────────────────────────────────

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

const promptTemplateArb = nonEmptyStringArb;

const adapterConfigWithPromptArb = promptTemplateArb.map((pt) => ({
  promptTemplate: pt,
  cwd: "/some/path",
  instructionsFilePath: "skills/default.md",
}));

const heartbeatFieldsArb = fc.record({
  enabled: fc.boolean(),
  intervalSec: fc.integer({ min: 1, max: 86400 }),
  wakeOnAssignment: fc.boolean(),
  wakeOnMention: fc.boolean(),
  wakeOnDemand: fc.boolean(),
  maxConcurrentRuns: fc.integer({ min: 1, max: 100 }),
  timeoutSec: fc.integer({ min: 1, max: 7200 }),
  cooldownSec: fc.integer({ min: 0, max: 3600 }),
});

const runtimeConfigWithHeartbeatArb = heartbeatFieldsArb.map((hb) => ({
  heartbeat: hb,
  otherField: "preserved",
}));

const capabilitiesTextArb = fc.array(nonEmptyStringArb, { minLength: 1, maxLength: 10 })
  .map((tags) => tags.join(", "));

const structuredCapabilitiesArb = fc.record({
  languages: fc.array(nonEmptyStringArb, { maxLength: 5 }),
  frameworks: fc.array(nonEmptyStringArb, { maxLength: 5 }),
  domains: fc.array(nonEmptyStringArb, { maxLength: 5 }),
  tools: fc.array(nonEmptyStringArb, { maxLength: 5 }),
  customTags: fc.array(nonEmptyStringArb, { maxLength: 5 }),
});

// ── Property 22 Tests ───────────────────────────────────────────────────────

describe("Property 22: Migration data equivalence", () => {
  describe("Soul migration", () => {
    it("migrated systemPrompt equals original promptTemplate", () => {
      fc.assert(
        fc.property(adapterConfigWithPromptArb, (config) => {
          const result = extractSoul(config);
          expect(result).not.toBeNull();
          expect(result!.systemPrompt).toBe(config.promptTemplate);
          expect(result!.version).toBe(1);
        }),
        { numRuns: 500 },
      );
    });

    it("original adapterConfig is NOT modified after soul extraction", () => {
      fc.assert(
        fc.property(adapterConfigWithPromptArb, (config) => {
          const originalPrompt = config.promptTemplate;
          const originalKeys = Object.keys(config).sort();
          const snapshot = JSON.parse(JSON.stringify(config));

          extractSoul(config);

          // Source data preserved for fallback
          expect(config.promptTemplate).toBe(originalPrompt);
          expect(Object.keys(config).sort()).toEqual(originalKeys);
          expect(config).toEqual(snapshot);
        }),
        { numRuns: 500 },
      );
    });
  });

  describe("Heartbeat migration", () => {
    it("migrated heartbeat fields match original runtimeConfig.heartbeat values", () => {
      fc.assert(
        fc.property(runtimeConfigWithHeartbeatArb, (config) => {
          const result = extractHeartbeat(config);
          expect(result).not.toBeNull();

          const hb = config.heartbeat as Record<string, unknown>;
          expect(result!.enabled).toBe(hb.enabled);
          expect(result!.intervalSec).toBe(Math.floor(hb.intervalSec as number));
          expect(result!.wakeOnAssignment).toBe(hb.wakeOnAssignment);
          expect(result!.wakeOnMention).toBe(hb.wakeOnMention);
          expect(result!.wakeOnDemand).toBe(hb.wakeOnDemand);
          expect(result!.maxConcurrentRuns).toBe(Math.floor(hb.maxConcurrentRuns as number));
          expect(result!.timeoutSec).toBe(Math.floor(hb.timeoutSec as number));
          expect(result!.cooldownSec).toBe(Math.floor(hb.cooldownSec as number));
        }),
        { numRuns: 500 },
      );
    });

    it("defaults are applied for missing heartbeat fields", () => {
      fc.assert(
        fc.property(
          fc.record({
            heartbeat: fc.record({}, { withDeletedKeys: false }),
          }),
          (config) => {
            const result = extractHeartbeat(config);
            expect(result).not.toBeNull();
            // All defaults applied
            expect(result!.enabled).toBe(true);
            expect(result!.intervalSec).toBe(300);
            expect(result!.wakeOnAssignment).toBe(true);
            expect(result!.wakeOnMention).toBe(true);
            expect(result!.wakeOnDemand).toBe(true);
            expect(result!.maxConcurrentRuns).toBe(1);
            expect(result!.timeoutSec).toBe(600);
            expect(result!.cooldownSec).toBe(60);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("original runtimeConfig is NOT modified after heartbeat extraction", () => {
      fc.assert(
        fc.property(runtimeConfigWithHeartbeatArb, (config) => {
          const snapshot = JSON.parse(JSON.stringify(config));

          extractHeartbeat(config);

          // Source data preserved for fallback
          expect(config).toEqual(snapshot);
        }),
        { numRuns: 500 },
      );
    });
  });

  describe("Capabilities migration", () => {
    it("text capabilities are parsed into customTags containing original tokens", () => {
      fc.assert(
        fc.property(capabilitiesTextArb, (text) => {
          const result = parseCapabilities(text);
          const expectedTokens = text.split(",").map((s) => s.trim()).filter(Boolean);

          // All original tokens appear in customTags
          for (const token of expectedTokens) {
            expect(result.customTags).toContain(token);
          }
          // Other arrays are empty for text input
          expect(result.languages).toEqual([]);
          expect(result.frameworks).toEqual([]);
          expect(result.domains).toEqual([]);
          expect(result.tools).toEqual([]);
        }),
        { numRuns: 500 },
      );
    });

    it("already-structured capabilities are preserved as-is", () => {
      fc.assert(
        fc.property(structuredCapabilitiesArb, (structured) => {
          expect(isAlreadyStructured(structured)).toBe(true);

          // If we parse it anyway, arrays are preserved
          const result = parseCapabilities(structured);
          expect(result.languages).toEqual(structured.languages.map(String));
          expect(result.frameworks).toEqual(structured.frameworks.map(String));
          expect(result.domains).toEqual(structured.domains.map(String));
          expect(result.tools).toEqual(structured.tools.map(String));
          expect(result.customTags).toEqual(structured.customTags.map(String));
        }),
        { numRuns: 500 },
      );
    });

    it("original capabilities text is NOT modified after parsing", () => {
      fc.assert(
        fc.property(capabilitiesTextArb, (text) => {
          const original = text;

          parseCapabilities(text);

          // Strings are immutable in JS, but verify the reference is unchanged
          expect(text).toBe(original);
        }),
        { numRuns: 200 },
      );
    });

    it("original structured capabilities object is NOT modified after parsing", () => {
      fc.assert(
        fc.property(structuredCapabilitiesArb, (structured) => {
          const snapshot = JSON.parse(JSON.stringify(structured));

          parseCapabilities(structured);

          expect(structured).toEqual(snapshot);
        }),
        { numRuns: 200 },
      );
    });
  });
});
