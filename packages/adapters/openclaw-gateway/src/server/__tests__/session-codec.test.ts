import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { sessionCodec } from "../session-codec.js";

// ─── Generators ─────────────────────────────────────────────────────────────

/** Non-empty trimmed string (simulates valid field values). */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/** Valid OpenClawSessionParams with required sessionKey and optional fields. */
const sessionParamsArb = fc.record(
  {
    sessionKey: nonEmptyStringArb,
    deviceId: nonEmptyStringArb,
    lastAgentId: nonEmptyStringArb,
    lastRunId: nonEmptyStringArb,
  },
  { requiredKeys: ["sessionKey"] },
);

// ─── Property 1: 会话编解码往返一致性 ────────────────────────────────────────
// **Validates: Requirements 1.1, 2.1, 3.1**

describe("Property 1: sessionCodec round-trip consistency", () => {
  it("deserialize(serialize(p)) deep-equals p for any valid OpenClawSessionParams", () => {
    fc.assert(
      fc.property(sessionParamsArb, (params) => {
        const serialized = sessionCodec.serialize(params);
        expect(serialized).not.toBeNull();

        const deserialized = sessionCodec.deserialize(serialized);
        expect(deserialized).not.toBeNull();

        // Round-trip should produce deep-equal result
        expect(deserialized).toEqual(params);
      }),
      { numRuns: 200 },
    );
  });

  it("round-trip preserves all present optional fields", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        (sessionKey, deviceId, lastAgentId, lastRunId) => {
          const params = { sessionKey, deviceId, lastAgentId, lastRunId };
          const roundTripped = sessionCodec.deserialize(
            sessionCodec.serialize(params),
          );
          expect(roundTripped).toEqual(params);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("round-trip works with only sessionKey (no optional fields)", () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (sessionKey) => {
        const params = { sessionKey };
        const roundTripped = sessionCodec.deserialize(
          sessionCodec.serialize(params),
        );
        expect(roundTripped).toEqual(params);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 2: 会话反序列化防御性 ──────────────────────────────────────────
// **Validates: Requirements 1.2, 2.2**

describe("Property 2: sessionCodec deserialization defensiveness", () => {
  it("returns null for any non-object JSON value (null, array, number, string, boolean)", () => {
    const nonObjectArb = fc.oneof(
      fc.constant(null),
      fc.array(fc.anything()),
      fc.double(),
      fc.integer(),
      fc.string(),
      fc.boolean(),
    );

    fc.assert(
      fc.property(nonObjectArb, (value) => {
        expect(sessionCodec.deserialize(value)).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it("returns null for objects missing a non-empty sessionKey", () => {
    const objectMissingSessionKeyArb = fc.oneof(
      // No sessionKey at all
      fc.record({
        deviceId: fc.option(fc.string(), { nil: undefined }),
        lastAgentId: fc.option(fc.string(), { nil: undefined }),
      }),
      // sessionKey is empty string
      fc.record({
        sessionKey: fc.constant(""),
        deviceId: fc.option(fc.string(), { nil: undefined }),
      }),
      // sessionKey is whitespace-only
      fc.record({
        sessionKey: fc.constant("   "),
        deviceId: fc.option(fc.string(), { nil: undefined }),
      }),
      // sessionKey is non-string type
      fc.record({
        sessionKey: fc.oneof(
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.array(fc.anything()),
          fc.dictionary(fc.string(), fc.anything()),
        ),
      }),
    );

    fc.assert(
      fc.property(objectMissingSessionKeyArb, (value) => {
        expect(sessionCodec.deserialize(value)).toBeNull();
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 3: 会话序列化字段过滤 ──────────────────────────────────────────
// **Validates: Requirement 1.3**

describe("Property 3: sessionCodec serialize field filtering", () => {
  const KNOWN_KEYS = new Set(["sessionKey", "deviceId", "lastAgentId", "lastRunId"]);

  it("serialize() output only contains known fields, even when input has arbitrary extra fields", () => {
    const extraFieldsArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 50 }).filter((k) => !KNOWN_KEYS.has(k)),
      fc.anything(),
    );

    fc.assert(
      fc.property(
        nonEmptyStringArb,
        fc.option(nonEmptyStringArb, { nil: undefined }),
        fc.option(nonEmptyStringArb, { nil: undefined }),
        fc.option(nonEmptyStringArb, { nil: undefined }),
        extraFieldsArb,
        (sessionKey, deviceId, lastAgentId, lastRunId, extras) => {
          const input: Record<string, unknown> = {
            sessionKey,
            ...extras,
          };
          if (deviceId !== undefined) input.deviceId = deviceId;
          if (lastAgentId !== undefined) input.lastAgentId = lastAgentId;
          if (lastRunId !== undefined) input.lastRunId = lastRunId;

          const result = sessionCodec.serialize(input);
          expect(result).not.toBeNull();

          const resultKeys = Object.keys(result!);
          for (const key of resultKeys) {
            expect(KNOWN_KEYS.has(key)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("serialize() never leaks extra fields regardless of their value types", () => {
    const poisonFieldsArb = fc.record({
      __proto__: fc.option(fc.anything(), { nil: undefined }),
      constructor: fc.option(fc.anything(), { nil: undefined }),
      toString: fc.option(fc.anything(), { nil: undefined }),
      secret: fc.option(fc.string(), { nil: undefined }),
      password: fc.option(fc.string(), { nil: undefined }),
      extraNumber: fc.option(fc.integer(), { nil: undefined }),
      extraBool: fc.option(fc.boolean(), { nil: undefined }),
      nested: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
    });

    fc.assert(
      fc.property(nonEmptyStringArb, poisonFieldsArb, (sessionKey, poison) => {
        const input: Record<string, unknown> = { sessionKey, ...poison };
        const result = sessionCodec.serialize(input);
        expect(result).not.toBeNull();

        for (const key of Object.keys(result!)) {
          expect(KNOWN_KEYS.has(key)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
