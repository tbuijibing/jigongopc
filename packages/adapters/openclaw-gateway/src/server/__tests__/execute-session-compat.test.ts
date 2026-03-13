import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { sessionCodec } from "../session-codec.js";

// ─── Generators ─────────────────────────────────────────────────────────────

/** Non-empty trimmed string (simulates valid field values). */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Generates sessionParams shapes that execute() could plausibly return:
 * - Valid params with sessionKey and optional fields
 * - null (when execute fails before establishing a session)
 * - Objects missing sessionKey
 * - Objects with extra unknown fields
 */
const executeSessionParamsArb = fc.oneof(
  // Valid session params (success path)
  fc.record(
    {
      sessionKey: nonEmptyStringArb,
      deviceId: nonEmptyStringArb,
      lastAgentId: nonEmptyStringArb,
      lastRunId: nonEmptyStringArb,
    },
    { requiredKeys: ["sessionKey"] },
  ),
  // null (error/early-return paths)
  fc.constant(null),
  // Object with extra fields (gateway may add unknown fields)
  fc.record(
    {
      sessionKey: nonEmptyStringArb,
      deviceId: nonEmptyStringArb,
      lastAgentId: nonEmptyStringArb,
      lastRunId: nonEmptyStringArb,
      extraField: fc.string(),
      numericField: fc.integer(),
    },
    { requiredKeys: ["sessionKey"] },
  ),
  // Object missing sessionKey (edge case)
  fc.record({
    deviceId: fc.option(nonEmptyStringArb, { nil: undefined }),
    lastAgentId: fc.option(nonEmptyStringArb, { nil: undefined }),
  }),
);

// ─── Property 10: execute 结果与 sessionCodec 兼容性 ────────────────────────
// **Validates: Requirements 9.4**

describe("Property 10: execute result sessionCodec compatibility", () => {
  it("sessionCodec.serialize() handles any plausible sessionParams without throwing", () => {
    fc.assert(
      fc.property(executeSessionParamsArb, (sessionParams) => {
        // serialize must never throw — it returns a valid object or null
        const result = sessionCodec.serialize(sessionParams);
        expect(result === null || typeof result === "object").toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("sessionCodec.serialize() result is always JSON-serializable", () => {
    fc.assert(
      fc.property(executeSessionParamsArb, (sessionParams) => {
        const serialized = sessionCodec.serialize(sessionParams);
        if (serialized !== null) {
          // Must not throw during JSON serialization
          const json = JSON.stringify(serialized);
          expect(typeof json).toBe("string");
          // Must round-trip through JSON
          const parsed = JSON.parse(json);
          expect(parsed).toEqual(serialized);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("sessionCodec.serialize() then deserialize() is idempotent for valid params", () => {
    fc.assert(
      fc.property(executeSessionParamsArb, (sessionParams) => {
        const serialized = sessionCodec.serialize(sessionParams);
        if (serialized !== null) {
          const deserialized = sessionCodec.deserialize(serialized);
          expect(deserialized).not.toBeNull();
          // Re-serializing should produce the same result
          const reSerialized = sessionCodec.serialize(deserialized);
          expect(reSerialized).toEqual(serialized);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("arbitrary JSON values never cause sessionCodec.serialize() to throw", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        // Cast to the expected type — serialize should handle gracefully
        const result = sessionCodec.serialize(value as Record<string, unknown> | null);
        expect(result === null || typeof result === "object").toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
