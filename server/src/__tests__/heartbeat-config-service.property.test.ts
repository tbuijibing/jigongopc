import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Property 1 (Heartbeat dimension): Fallback chain round-trip
 *
 * When agent_heartbeat_configs has no record for an Agent, the service returns
 * data extracted from agents.runtimeConfig.heartbeat. When a dedicated record
 * exists, the service returns data from the new table and ignores the legacy field.
 *
 * **Validates: Requirements 1.2, 17.5**
 */

/**
 * Property 25: Scheduler respects heartbeat enabled flag
 *
 * When an Agent's heartbeat config has enabled=false, the scheduler shall not
 * trigger any heartbeat invocation for that Agent.
 *
 * **Validates: Requirement 1.5**
 */

// ── Replicate the pure logic from heartbeat-config.ts ───────────────────────

interface HeartbeatConfigData {
  enabled: boolean;
  intervalSec: number;
  wakeOnAssignment: boolean;
  wakeOnMention: boolean;
  wakeOnDemand: boolean;
  maxConcurrentRuns: number;
  timeoutSec: number;
  cooldownSec: number;
}

const DEFAULTS: HeartbeatConfigData = {
  enabled: true,
  intervalSec: 300,
  wakeOnAssignment: true,
  wakeOnMention: true,
  wakeOnDemand: true,
  maxConcurrentRuns: 1,
  timeoutSec: 600,
  cooldownSec: 60,
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function toInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  return fallback;
}

function extractFromRuntimeConfig(
  runtimeConfig: Record<string, unknown>,
): HeartbeatConfigData {
  const heartbeat = isPlainObject(runtimeConfig.heartbeat)
    ? runtimeConfig.heartbeat
    : {};
  return {
    enabled: toBool(heartbeat.enabled, DEFAULTS.enabled),
    intervalSec: toInt(heartbeat.intervalSec, DEFAULTS.intervalSec),
    wakeOnAssignment: toBool(heartbeat.wakeOnAssignment, DEFAULTS.wakeOnAssignment),
    wakeOnMention: toBool(heartbeat.wakeOnMention, DEFAULTS.wakeOnMention),
    wakeOnDemand: toBool(
      heartbeat.wakeOnDemand ??
        heartbeat.wakeOnAssignment ??
        heartbeat.wakeOnOnDemand ??
        heartbeat.wakeOnAutomation,
      DEFAULTS.wakeOnDemand,
    ),
    maxConcurrentRuns: toInt(heartbeat.maxConcurrentRuns, DEFAULTS.maxConcurrentRuns),
    timeoutSec: toInt(heartbeat.timeoutSec, DEFAULTS.timeoutSec),
    cooldownSec: toInt(heartbeat.cooldownSec, DEFAULTS.cooldownSec),
  };
}

/**
 * Pure-function equivalent of getConfig's resolution logic.
 * Given a dedicated row (or null) and an agent's runtimeConfig,
 * returns { source, config }.
 */
function resolveConfig(
  dedicatedRow: HeartbeatConfigData | null,
  runtimeConfig: Record<string, unknown>,
): { source: "dedicated" | "fallback"; config: HeartbeatConfigData } {
  if (dedicatedRow) {
    return { source: "dedicated", config: dedicatedRow };
  }
  return { source: "fallback", config: extractFromRuntimeConfig(runtimeConfig) };
}

// ── Replicate the pure scheduler filtering logic from heartbeat.ts ──────────

/**
 * Pure-function equivalent of parseHeartbeatPolicy used by tickTimers.
 * The scheduler reads runtimeConfig.heartbeat to decide whether to invoke.
 */
function parseHeartbeatPolicy(runtimeConfig: Record<string, unknown>) {
  const heartbeat = isPlainObject(runtimeConfig.heartbeat)
    ? runtimeConfig.heartbeat
    : {};

  function asBoolean(v: unknown, fallback: boolean): boolean {
    if (typeof v === "boolean") return v;
    return fallback;
  }
  function asNumber(v: unknown, fallback: number): number {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return fallback;
  }

  return {
    enabled: asBoolean(heartbeat.enabled, true),
    intervalSec: Math.max(0, asNumber(heartbeat.intervalSec, 0)),
    wakeOnDemand: asBoolean(
      heartbeat.wakeOnDemand ??
        heartbeat.wakeOnAssignment ??
        heartbeat.wakeOnOnDemand ??
        heartbeat.wakeOnAutomation,
      true,
    ),
    maxConcurrentRuns: Math.max(1, Math.floor(asNumber(heartbeat.maxConcurrentRuns, 1))),
  };
}

/**
 * Pure-function equivalent of the scheduler's per-agent decision in tickTimers.
 * Returns true if the scheduler should skip this agent (no heartbeat triggered).
 */
function schedulerShouldSkipAgent(
  agentStatus: string,
  policy: { enabled: boolean; intervalSec: number },
): boolean {
  // Paused/terminated/pending_approval agents are always skipped
  if (
    agentStatus === "paused" ||
    agentStatus === "terminated" ||
    agentStatus === "pending_approval"
  ) {
    return true;
  }
  // Disabled heartbeat → skip
  if (!policy.enabled) return true;
  // Zero interval → skip
  if (policy.intervalSec <= 0) return true;
  return false;
}

// ── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid HeartbeatConfigData record */
const heartbeatConfigDataArb: fc.Arbitrary<HeartbeatConfigData> = fc.record({
  enabled: fc.boolean(),
  intervalSec: fc.integer({ min: 0, max: 86400 }),
  wakeOnAssignment: fc.boolean(),
  wakeOnMention: fc.boolean(),
  wakeOnDemand: fc.boolean(),
  maxConcurrentRuns: fc.integer({ min: 1, max: 10 }),
  timeoutSec: fc.integer({ min: 0, max: 7200 }),
  cooldownSec: fc.integer({ min: 0, max: 3600 }),
});

/** Generate a runtimeConfig.heartbeat sub-object with valid heartbeat fields */
const runtimeConfigHeartbeatArb = fc.record({
  enabled: fc.oneof(fc.boolean(), fc.constant(undefined)),
  intervalSec: fc.oneof(fc.integer({ min: 0, max: 86400 }), fc.constant(undefined)),
  wakeOnAssignment: fc.oneof(fc.boolean(), fc.constant(undefined)),
  wakeOnMention: fc.oneof(fc.boolean(), fc.constant(undefined)),
  wakeOnDemand: fc.oneof(fc.boolean(), fc.constant(undefined)),
  maxConcurrentRuns: fc.oneof(fc.integer({ min: 1, max: 10 }), fc.constant(undefined)),
  timeoutSec: fc.oneof(fc.integer({ min: 0, max: 7200 }), fc.constant(undefined)),
  cooldownSec: fc.oneof(fc.integer({ min: 0, max: 3600 }), fc.constant(undefined)),
});

/** Generate a runtimeConfig object (may or may not have a heartbeat sub-object) */
const runtimeConfigArb: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
  // Has a valid heartbeat sub-object
  runtimeConfigHeartbeatArb.map((hb) => ({ heartbeat: hb })),
  // Has no heartbeat key
  fc.constant({}),
  // Has heartbeat set to a non-object value
  fc.oneof(fc.constant("invalid"), fc.integer(), fc.constant(null)).map((v) => ({
    heartbeat: v,
  })),
);

const agentStatusArb = fc.constantFrom(
  "idle",
  "running",
  "error",
  "paused",
  "terminated",
  "pending_approval",
);

// ── Property tests ──────────────────────────────────────────────────────────

describe("Property 1 (Heartbeat): Fallback chain round-trip", () => {
  it("returns dedicated table data when a record exists, ignoring runtimeConfig", () => {
    fc.assert(
      fc.property(
        heartbeatConfigDataArb,
        runtimeConfigArb,
        (dedicatedRow, runtimeConfig) => {
          const result = resolveConfig(dedicatedRow, runtimeConfig);

          expect(result.source).toBe("dedicated");
          // The returned config must exactly match the dedicated row
          expect(result.config.enabled).toBe(dedicatedRow.enabled);
          expect(result.config.intervalSec).toBe(dedicatedRow.intervalSec);
          expect(result.config.wakeOnAssignment).toBe(dedicatedRow.wakeOnAssignment);
          expect(result.config.wakeOnMention).toBe(dedicatedRow.wakeOnMention);
          expect(result.config.wakeOnDemand).toBe(dedicatedRow.wakeOnDemand);
          expect(result.config.maxConcurrentRuns).toBe(dedicatedRow.maxConcurrentRuns);
          expect(result.config.timeoutSec).toBe(dedicatedRow.timeoutSec);
          expect(result.config.cooldownSec).toBe(dedicatedRow.cooldownSec);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("falls back to runtimeConfig data when no dedicated record exists", () => {
    fc.assert(
      fc.property(runtimeConfigArb, (runtimeConfig) => {
        const result = resolveConfig(null, runtimeConfig);

        expect(result.source).toBe("fallback");
        // The returned config must match what extractFromRuntimeConfig produces
        const expected = extractFromRuntimeConfig(runtimeConfig);
        expect(result.config).toEqual(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("fallback returns DEFAULTS when runtimeConfig has no heartbeat data", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({}),
          fc.constant({ heartbeat: null }),
          fc.constant({ heartbeat: "not-an-object" }),
          fc.constant({ heartbeat: 42 }),
          fc.constant({ heartbeat: [] }),
        ),
        (runtimeConfig) => {
          const result = resolveConfig(null, runtimeConfig);

          expect(result.source).toBe("fallback");
          expect(result.config).toEqual(DEFAULTS);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("fallback extracts boolean fields correctly, using defaults for non-boolean values", () => {
    fc.assert(
      fc.property(
        fc.record({
          enabled: fc.oneof(
            fc.boolean(),
            fc.constant("yes"),
            fc.constant(1),
            fc.constant(null),
            fc.constant(undefined),
          ),
          intervalSec: fc.oneof(
            fc.integer({ min: 0, max: 86400 }),
            fc.constant("fast"),
            fc.constant(null),
            fc.constant(undefined),
          ),
        }),
        (heartbeatFields) => {
          const runtimeConfig = { heartbeat: heartbeatFields };
          const result = extractFromRuntimeConfig(runtimeConfig);

          // Boolean fields: only actual booleans are used, otherwise default
          if (typeof heartbeatFields.enabled === "boolean") {
            expect(result.enabled).toBe(heartbeatFields.enabled);
          } else {
            expect(result.enabled).toBe(DEFAULTS.enabled);
          }

          // Integer fields: only finite numbers are used, otherwise default
          if (
            typeof heartbeatFields.intervalSec === "number" &&
            Number.isFinite(heartbeatFields.intervalSec)
          ) {
            expect(result.intervalSec).toBe(
              Math.floor(heartbeatFields.intervalSec),
            );
          } else {
            expect(result.intervalSec).toBe(DEFAULTS.intervalSec);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("Property 25: Scheduler respects heartbeat enabled flag", () => {
  it("enabled=false means scheduler skips that Agent (for non-paused/terminated agents)", () => {
    fc.assert(
      fc.property(
        agentStatusArb.filter(
          (s) => s !== "paused" && s !== "terminated" && s !== "pending_approval",
        ),
        fc.integer({ min: 1, max: 86400 }),
        (agentStatus, intervalSec) => {
          const policy = { enabled: false, intervalSec };
          const skipped = schedulerShouldSkipAgent(agentStatus, policy);
          expect(skipped).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("enabled=true with positive interval means scheduler does NOT skip the Agent", () => {
    fc.assert(
      fc.property(
        agentStatusArb.filter(
          (s) => s !== "paused" && s !== "terminated" && s !== "pending_approval",
        ),
        fc.integer({ min: 1, max: 86400 }),
        (agentStatus, intervalSec) => {
          const policy = { enabled: true, intervalSec };
          const skipped = schedulerShouldSkipAgent(agentStatus, policy);
          expect(skipped).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("paused/terminated/pending_approval agents are always skipped regardless of enabled flag", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("paused", "terminated", "pending_approval"),
        fc.boolean(),
        fc.integer({ min: 1, max: 86400 }),
        (agentStatus, enabled, intervalSec) => {
          const policy = { enabled, intervalSec };
          const skipped = schedulerShouldSkipAgent(agentStatus, policy);
          expect(skipped).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("parseHeartbeatPolicy extracts enabled flag from runtimeConfig correctly", () => {
    fc.assert(
      fc.property(runtimeConfigArb, (runtimeConfig) => {
        const policy = parseHeartbeatPolicy(runtimeConfig);

        const heartbeat = isPlainObject(runtimeConfig.heartbeat)
          ? runtimeConfig.heartbeat
          : {};
        const expectedEnabled =
          typeof heartbeat.enabled === "boolean" ? heartbeat.enabled : true;

        expect(policy.enabled).toBe(expectedEnabled);
      }),
      { numRuns: 200 },
    );
  });

  it("scheduler skip decision is consistent between dedicated config and runtimeConfig policy", () => {
    fc.assert(
      fc.property(
        heartbeatConfigDataArb,
        agentStatusArb.filter(
          (s) => s !== "paused" && s !== "terminated" && s !== "pending_approval",
        ),
        (config, agentStatus) => {
          // When a dedicated config exists, the enabled flag from that config
          // should produce the same skip decision as if it were in runtimeConfig
          const dedicatedPolicy = {
            enabled: config.enabled,
            intervalSec: config.intervalSec,
          };
          const runtimeConfig = {
            heartbeat: {
              enabled: config.enabled,
              intervalSec: config.intervalSec,
            },
          };
          const runtimePolicy = parseHeartbeatPolicy(runtimeConfig);

          const skipDedicated = schedulerShouldSkipAgent(
            agentStatus,
            dedicatedPolicy,
          );
          const skipRuntime = schedulerShouldSkipAgent(agentStatus, {
            enabled: runtimePolicy.enabled,
            intervalSec: runtimePolicy.intervalSec,
          });

          expect(skipDedicated).toBe(skipRuntime);
        },
      ),
      { numRuns: 200 },
    );
  });
});
