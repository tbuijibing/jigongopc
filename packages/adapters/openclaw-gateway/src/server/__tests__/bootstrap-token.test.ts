import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { mintBootstrapToken } from "../bootstrap-token.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

// ─── Generators ─────────────────────────────────────────────────────────────

const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

const positiveTtlArb = fc.integer({ min: 1, max: 86_400 });

const signingKeyArb = fc.string({ minLength: 8, maxLength: 64 }).filter((s) => s.length >= 8);

// ─── Property 7: 引导令牌结构正确性 ─────────────────────────────────────────
// **Validates: Requirements 6.2, 6.3, 6.4**

describe("Property 7: bootstrap token structural correctness", () => {
  it("exp - iat === ttlSeconds for any valid inputs", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        positiveTtlArb,
        signingKeyArb,
        (agentId, companyId, runId, ttlSeconds, signingKey) => {
          const token = mintBootstrapToken({
            agentId,
            companyId,
            runId,
            ttlSeconds,
            signingKey,
          });

          const payload = decodeJwtPayload(token);
          const iat = payload.iat as number;
          const exp = payload.exp as number;

          expect(typeof iat).toBe("number");
          expect(typeof exp).toBe("number");
          expect(exp - iat).toBe(ttlSeconds);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('aud === "Jigong:bootstrap" for any valid inputs', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        positiveTtlArb,
        signingKeyArb,
        (agentId, companyId, runId, ttlSeconds, signingKey) => {
          const token = mintBootstrapToken({
            agentId,
            companyId,
            runId,
            ttlSeconds,
            signingKey,
          });

          const payload = decodeJwtPayload(token);
          expect(payload.aud).toBe("Jigong:bootstrap");
        },
      ),
      { numRuns: 200 },
    );
  });

  it("each call produces a unique jti", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        signingKeyArb,
        (agentId, companyId, runId, signingKey) => {
          const params = { agentId, companyId, runId, ttlSeconds: 600, signingKey };
          const token1 = mintBootstrapToken(params);
          const token2 = mintBootstrapToken(params);

          const jti1 = decodeJwtPayload(token1).jti as string;
          const jti2 = decodeJwtPayload(token2).jti as string;

          expect(typeof jti1).toBe("string");
          expect(jti1.length).toBeGreaterThan(0);
          expect(jti1).not.toBe(jti2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("sub, cid, rid match the input params", () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        positiveTtlArb,
        signingKeyArb,
        (agentId, companyId, runId, ttlSeconds, signingKey) => {
          const token = mintBootstrapToken({
            agentId,
            companyId,
            runId,
            ttlSeconds,
            signingKey,
          });

          const payload = decodeJwtPayload(token);
          expect(payload.sub).toBe(agentId);
          expect(payload.cid).toBe(companyId);
          expect(payload.rid).toBe(runId);
          expect(payload.iss).toBe("Jigong");
        },
      ),
      { numRuns: 200 },
    );
  });
});
