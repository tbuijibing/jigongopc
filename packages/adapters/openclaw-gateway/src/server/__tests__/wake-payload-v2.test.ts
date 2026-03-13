import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildWakePayloadV2 } from "../wake-payload-v2.js";

// ─── Generators ─────────────────────────────────────────────────────────────

const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

const apiUrlArb = fc.constantFrom(
  "https://Jigong.example.com",
  "http://localhost:3100",
  "https://api.test.io",
);

const optionalStringArb = fc.option(nonEmptyStringArb, { nil: null });

const linkedIssueIdsArb = fc.array(nonEmptyStringArb, { minLength: 0, maxLength: 5 });

const bootstrapTokenArb = fc.oneof(
  nonEmptyStringArb,
  fc.constant(null as string | null),
);

/** Full params generator for buildWakePayloadV2. */
const wakeParamsArb = fc.record({
  runId: nonEmptyStringArb,
  agentId: nonEmptyStringArb,
  companyId: nonEmptyStringArb,
  JigongApiUrl: apiUrlArb,
  bootstrapToken: bootstrapTokenArb,
  taskId: optionalStringArb,
  issueId: optionalStringArb,
  wakeReason: optionalStringArb,
  wakeCommentId: optionalStringArb,
  approvalId: optionalStringArb,
  approvalStatus: optionalStringArb,
  linkedIssueIds: linkedIssueIdsArb,
});

// ─── Property 8: 结构化唤醒载荷完整性 ───────────────────────────────────────
// **Validates: Requirements 7.2, 7.5, 7.6, 10.1, 10.2**

describe("Property 8: structured wake payload completeness", () => {
  it("payload has version=2, auth, skills, run, api, workflow for any valid context", () => {
    fc.assert(
      fc.property(wakeParamsArb, (params) => {
        const { payload } = buildWakePayloadV2(params);

        expect(payload.version).toBe(2);
        expect(payload.auth).toBeDefined();
        expect(payload.auth.method).toMatch(/^(bootstrap_exchange|api_key_file)$/);
        expect(payload.skills).toBeDefined();
        expect(payload.run).toBeDefined();
        expect(payload.api).toBeDefined();
        expect(payload.workflow).toBeDefined();
        expect(Array.isArray(payload.workflow)).toBe(true);
        expect(payload.workflow.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it("skills block contains indexUrl ending with /api/skills/index and required includes 'Jigong'", () => {
    fc.assert(
      fc.property(wakeParamsArb, (params) => {
        const { payload } = buildWakePayloadV2(params);

        expect(payload.skills.indexUrl).toContain("/api/skills/index");
        expect(payload.skills.indexUrl.startsWith(params.JigongApiUrl)).toBe(true);
        expect(payload.skills.required).toContain("Jigong");
      }),
      { numRuns: 200 },
    );
  });

  it("run block contains runId, agentId, companyId matching inputs", () => {
    fc.assert(
      fc.property(wakeParamsArb, (params) => {
        const { payload } = buildWakePayloadV2(params);

        expect(payload.run.runId).toBe(params.runId);
        expect(payload.run.agentId).toBe(params.agentId);
        expect(payload.run.companyId).toBe(params.companyId);
        expect(Array.isArray(payload.run.linkedIssueIds)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("api block contains baseUrl matching JigongApiUrl", () => {
    fc.assert(
      fc.property(wakeParamsArb, (params) => {
        const { payload } = buildWakePayloadV2(params);

        expect(payload.api.baseUrl).toBe(params.JigongApiUrl);
        expect(typeof payload.api.headers).toBe("object");
      }),
      { numRuns: 200 },
    );
  });

  it("message is a non-empty string", () => {
    fc.assert(
      fc.property(wakeParamsArb, (params) => {
        const { message } = buildWakePayloadV2(params);

        expect(typeof message).toBe("string");
        expect(message.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 9: 认证方式由配置决定 ─────────────────────────────────────────
// **Validates: Requirements 7.3, 7.4**

describe("Property 9: auth method determined by bootstrapToken", () => {
  it("when bootstrapToken is provided, auth.method is bootstrap_exchange with exchangeUrl and bootstrapToken", () => {
    const paramsWithTokenArb = fc.record({
      runId: nonEmptyStringArb,
      agentId: nonEmptyStringArb,
      companyId: nonEmptyStringArb,
      JigongApiUrl: apiUrlArb,
      bootstrapToken: nonEmptyStringArb, // always non-null
      taskId: optionalStringArb,
      issueId: optionalStringArb,
      wakeReason: optionalStringArb,
      wakeCommentId: optionalStringArb,
      approvalId: optionalStringArb,
      approvalStatus: optionalStringArb,
      linkedIssueIds: linkedIssueIdsArb,
    });

    fc.assert(
      fc.property(paramsWithTokenArb, (params) => {
        const { payload } = buildWakePayloadV2(params);

        expect(payload.auth.method).toBe("bootstrap_exchange");
        expect(payload.auth.exchangeUrl).toBeDefined();
        expect(typeof payload.auth.exchangeUrl).toBe("string");
        expect(payload.auth.exchangeUrl!.length).toBeGreaterThan(0);
        expect(payload.auth.exchangeUrl).toContain("/api/agent-auth/exchange");
        expect(payload.auth.bootstrapToken).toBe(params.bootstrapToken);
      }),
      { numRuns: 200 },
    );
  });

  it("when bootstrapToken is null, auth.method is api_key_file with apiKeyFilePath", () => {
    const paramsWithoutTokenArb = fc.record({
      runId: nonEmptyStringArb,
      agentId: nonEmptyStringArb,
      companyId: nonEmptyStringArb,
      JigongApiUrl: apiUrlArb,
      bootstrapToken: fc.constant(null as string | null),
      taskId: optionalStringArb,
      issueId: optionalStringArb,
      wakeReason: optionalStringArb,
      wakeCommentId: optionalStringArb,
      approvalId: optionalStringArb,
      approvalStatus: optionalStringArb,
      linkedIssueIds: linkedIssueIdsArb,
    });

    fc.assert(
      fc.property(paramsWithoutTokenArb, (params) => {
        const { payload } = buildWakePayloadV2(params);

        expect(payload.auth.method).toBe("api_key_file");
        expect(payload.auth.apiKeyFilePath).toBeDefined();
        expect(typeof payload.auth.apiKeyFilePath).toBe("string");
        expect(payload.auth.apiKeyFilePath!.length).toBeGreaterThan(0);
        // Should not have bootstrap fields
        expect(payload.auth.exchangeUrl).toBeUndefined();
        expect(payload.auth.bootstrapToken).toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });
});
