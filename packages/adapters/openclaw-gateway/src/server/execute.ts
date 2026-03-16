import type { AdapterExecutionContext, AdapterExecutionResult } from "@Jigongai/adapter-utils";
import { asNumber, asString, buildJiGongEnv, parseObject } from "@Jigongai/adapter-utils/server-utils";
import crypto from "node:crypto";

import { mintBootstrapToken } from "./bootstrap-token.js";
import { buildWakePayloadV2 } from "./wake-payload-v2.js";
import { CancellationRegistry, raceWithAbort } from "./cancel.js";
import {
  asRecord,
  nonEmpty,
  parseBoolean,
  toStringRecord,
  headerMapHasIgnoreCase,
  toAuthorizationHeaderValue,
  resolveAuthToken,
  normalizeUrl,
  buildDeviceAuthPayloadV3,
  resolveDeviceIdentity,
  signDevicePayload,
  GatewayWsClient,
  PROTOCOL_VERSION,
  DEFAULT_SCOPES,
  DEFAULT_CLIENT_ID,
  DEFAULT_CLIENT_MODE,
  DEFAULT_CLIENT_VERSION,
  DEFAULT_ROLE,
  type GatewayDeviceIdentity,
  type GatewayEventFrame,
  type GatewayResponseError,
} from "./utils.js";

/** Module-level cancellation registry shared with the server to trigger run cancellation. */
export const cancellationRegistry = new CancellationRegistry();

type SessionKeyStrategy = "fixed" | "issue" | "run";

type WakePayload = {
  runId: string;
  agentId: string;
  companyId: string;
  taskId: string | null;
  issueId: string | null;
  wakeReason: string | null;
  wakeCommentId: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  issueIds: string[];
};

const SENSITIVE_LOG_KEY_PATTERN =
  /(^|[_-])(auth|authorization|token|secret|password|api[_-]?key|private[_-]?key)([_-]|$)|^x-openclaw-(auth|token)$/i;

function parseOptionalPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return Math.max(1, Math.floor(parsed));
  }
  return null;
}

function normalizeSessionKeyStrategy(value: unknown): SessionKeyStrategy {
  const normalized = asString(value, "issue").trim().toLowerCase();
  if (normalized === "fixed" || normalized === "run") return normalized;
  return "issue";
}

function resolveSessionKey(input: {
  strategy: SessionKeyStrategy;
  configuredSessionKey: string | null;
  runId: string;
  issueId: string | null;
}): string {
  const fallback = input.configuredSessionKey ?? "Jigong";
  if (input.strategy === "run") return `Jigong:run:${input.runId}`;
  if (input.strategy === "issue" && input.issueId) return `Jigong:issue:${input.issueId}`;
  return fallback;
}

function isLoopbackHost(hostname: string): boolean {
  const value = hostname.trim().toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeScopes(value: unknown): string[] {
  const parsed = toStringArray(value);
  return parsed.length > 0 ? parsed : [...DEFAULT_SCOPES];
}

function uniqueScopes(scopes: string[]): string[] {
  return Array.from(new Set(scopes.map((scope) => scope.trim()).filter(Boolean)));
}

function getGatewayErrorDetails(err: unknown): Record<string, unknown> | null {
  if (!err || typeof err !== "object") return null;
  const candidate = (err as GatewayResponseError).gatewayDetails;
  return asRecord(candidate);
}

function extractPairingRequestId(err: unknown): string | null {
  const details = getGatewayErrorDetails(err);
  const fromDetails = nonEmpty(details?.requestId);
  if (fromDetails) return fromDetails;
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/requestId\s*[:=]\s*([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function isSensitiveLogKey(key: string): boolean {
  return SENSITIVE_LOG_KEY_PATTERN.test(key.trim());
}

function sha256Prefix(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function redactSecretForLog(value: string): string {
  return `[redacted len=${value.length} sha256=${sha256Prefix(value)}]`;
}

function truncateForLog(value: string, maxChars = 320): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}... [truncated ${value.length - maxChars} chars]`;
}

function redactForLog(value: unknown, keyPath: string[] = [], depth = 0): unknown {
  const currentKey = keyPath[keyPath.length - 1] ?? "";
  if (typeof value === "string") {
    if (isSensitiveLogKey(currentKey)) return redactSecretForLog(value);
    return truncateForLog(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth >= 6) return "[array-truncated]";
    const out = value.slice(0, 20).map((entry, index) => redactForLog(entry, [...keyPath, `${index}`], depth + 1));
    if (value.length > 20) out.push(`[+${value.length - 20} more items]`);
    return out;
  }
  if (typeof value === "object") {
    if (depth >= 6) return "[object-truncated]";
    const entries = Object.entries(value as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    for (const [key, entry] of entries.slice(0, 80)) {
      out[key] = redactForLog(entry, [...keyPath, key], depth + 1);
    }
    if (entries.length > 80) {
      out.__truncated__ = `+${entries.length - 80} keys`;
    }
    return out;
  }
  return String(value);
}

function stringifyForLog(value: unknown, maxChars: number): string {
  const text = JSON.stringify(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}... [truncated ${text.length - maxChars} chars]`;
}

function buildWakePayload(ctx: AdapterExecutionContext): WakePayload {
  const { runId, agent, context } = ctx;
  return {
    runId,
    agentId: agent.id,
    companyId: agent.companyId,
    taskId: nonEmpty(context.taskId) ?? nonEmpty(context.issueId),
    issueId: nonEmpty(context.issueId),
    wakeReason: nonEmpty(context.wakeReason),
    wakeCommentId: nonEmpty(context.wakeCommentId) ?? nonEmpty(context.commentId),
    approvalId: nonEmpty(context.approvalId),
    approvalStatus: nonEmpty(context.approvalStatus),
    issueIds: Array.isArray(context.issueIds)
      ? context.issueIds.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [],
  };
}

function resolveJiGongApiUrlOverride(value: unknown): string | null {
  const raw = nonEmpty(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildJiGongEnvForWake(ctx: AdapterExecutionContext, wakePayload: WakePayload): Record<string, string> {
  const JigongApiUrlOverride = resolveJiGongApiUrlOverride(ctx.config.JigongApiUrl);
  const JigongEnv: Record<string, string> = {
    ...buildJiGongEnv(ctx.agent),
    Jigong_RUN_ID: ctx.runId,
  };

  if (JigongApiUrlOverride) {
    JigongEnv.Jigong_API_URL = JigongApiUrlOverride;
  }
  if (wakePayload.taskId) JigongEnv.Jigong_TASK_ID = wakePayload.taskId;
  if (wakePayload.wakeReason) JigongEnv.Jigong_WAKE_REASON = wakePayload.wakeReason;
  if (wakePayload.wakeCommentId) JigongEnv.Jigong_WAKE_COMMENT_ID = wakePayload.wakeCommentId;
  if (wakePayload.approvalId) JigongEnv.Jigong_APPROVAL_ID = wakePayload.approvalId;
  if (wakePayload.approvalStatus) JigongEnv.Jigong_APPROVAL_STATUS = wakePayload.approvalStatus;
  if (wakePayload.issueIds.length > 0) {
    JigongEnv.Jigong_LINKED_ISSUE_IDS = wakePayload.issueIds.join(",");
  }

  return JigongEnv;
}

function buildWakeText(payload: WakePayload, JigongEnv: Record<string, string>): string {
  const claimedApiKeyPath = "~/.openclaw/workspace/Jigong-claimed-api-key.json";
  const orderedKeys = [
    "Jigong_RUN_ID",
    "Jigong_AGENT_ID",
    "Jigong_COMPANY_ID",
    "Jigong_API_URL",
    "Jigong_TASK_ID",
    "Jigong_WAKE_REASON",
    "Jigong_WAKE_COMMENT_ID",
    "Jigong_APPROVAL_ID",
    "Jigong_APPROVAL_STATUS",
    "Jigong_LINKED_ISSUE_IDS",
  ];

  const envLines: string[] = [];
  for (const key of orderedKeys) {
    const value = JigongEnv[key];
    if (!value) continue;
    envLines.push(`${key}=${value}`);
  }

  const issueIdHint = payload.taskId ?? payload.issueId ?? "";
  const apiBaseHint = JigongEnv.Jigong_API_URL ?? "<set Jigong_API_URL>";

  const lines = [
    "JiGong wake event for a cloud adapter.",
    "",
    "Run this procedure now. Do not guess undocumented endpoints and do not ask for additional heartbeat docs.",
    "",
    "Set these values in your run context:",
    ...envLines,
    `Jigong_API_KEY=<token from ${claimedApiKeyPath}>`,
    "",
    `Load Jigong_API_KEY from ${claimedApiKeyPath} (the token you saved after claim-api-key).`,
    "",
    `api_base=${apiBaseHint}`,
    `task_id=${payload.taskId ?? ""}`,
    `issue_id=${payload.issueId ?? ""}`,
    `wake_reason=${payload.wakeReason ?? ""}`,
    `wake_comment_id=${payload.wakeCommentId ?? ""}`,
    `approval_id=${payload.approvalId ?? ""}`,
    `approval_status=${payload.approvalStatus ?? ""}`,
    `linked_issue_ids=${payload.issueIds.join(",")}`,
    "",
    "HTTP rules:",
    "- Use Authorization: Bearer $Jigong_API_KEY on every API call.",
    "- Use X-JiGong-Run-Id: $Jigong_RUN_ID on every mutating API call.",
    "- Use only /api endpoints listed below.",
    "- Do NOT call guessed endpoints like /api/cloud-adapter/*, /api/cloud-adapters/*, /api/adapters/cloud/*, or /api/heartbeat.",
    "",
    "Workflow:",
    "1) GET /api/agents/me",
    `2) Determine issueId: Jigong_TASK_ID if present, otherwise issue_id (${issueIdHint}).`,
    "3) If issueId exists:",
    "   - POST /api/issues/{issueId}/checkout with {\"agentId\":\"$Jigong_AGENT_ID\",\"expectedStatuses\":[\"todo\",\"backlog\",\"blocked\"]}",
    "   - GET /api/issues/{issueId}",
    "   - GET /api/issues/{issueId}/comments",
    "   - Execute the issue instructions exactly.",
    "   - If instructions require a comment, POST /api/issues/{issueId}/comments with {\"body\":\"...\"}.",
    "   - PATCH /api/issues/{issueId} with {\"status\":\"done\",\"comment\":\"what changed and why\"}.",
    "4) If issueId does not exist:",
    "   - GET /api/companies/$Jigong_COMPANY_ID/issues?assigneeAgentId=$Jigong_AGENT_ID&status=todo,in_progress,blocked",
    "   - Pick in_progress first, then todo, then blocked, then execute step 3.",
    "",
    "Useful endpoints for issue work:",
    "- POST /api/issues/{issueId}/comments",
    "- PATCH /api/issues/{issueId}",
    "- POST /api/companies/{companyId}/issues (when asked to create a new issue)",
    "",
    "Complete the workflow in this run.",
  ];
  return lines.join("\n");
}

function appendWakeText(baseText: string, wakeText: string): string {
  const trimmedBase = baseText.trim();
  return trimmedBase.length > 0 ? `${trimmedBase}\n\n${wakeText}` : wakeText;
}

async function autoApproveDevicePairing(params: {
  url: string;
  headers: Record<string, string>;
  connectTimeoutMs: number;
  clientId: string;
  clientMode: string;
  clientVersion: string;
  role: string;
  scopes: string[];
  authToken: string | null;
  password: string | null;
  requestId: string | null;
  deviceId: string | null;
  onLog: AdapterExecutionContext["onLog"];
}): Promise<{ ok: true; requestId: string } | { ok: false; reason: string }> {
  if (!params.authToken && !params.password) {
    return { ok: false, reason: "shared auth token/password is missing" };
  }

  const approvalScopes = uniqueScopes([...params.scopes, "operator.pairing"]);
  const client = new GatewayWsClient({
    url: params.url,
    headers: params.headers,
    onEvent: () => {},
    onLog: params.onLog as (stream: string, data: string) => Promise<void>,
  });

  try {
    await params.onLog(
      "stdout",
      "[openclaw-gateway] pairing required; attempting automatic pairing approval via gateway methods\n",
    );

    await client.connect(
      () => ({
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: params.clientId,
          version: params.clientVersion,
          platform: process.platform,
          mode: params.clientMode,
        },
        role: params.role,
        scopes: approvalScopes,
        auth: {
          ...(params.authToken ? { token: params.authToken } : {}),
          ...(params.password ? { password: params.password } : {}),
        },
      }),
      params.connectTimeoutMs,
    );

    let requestId = params.requestId;
    if (!requestId) {
      const listPayload = await client.request<Record<string, unknown>>("device.pair.list", {}, {
        timeoutMs: params.connectTimeoutMs,
      });
      const pending = Array.isArray(listPayload.pending) ? listPayload.pending : [];
      const pendingRecords = pending
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));
      const matching =
        (params.deviceId
          ? pendingRecords.find((entry) => nonEmpty(entry.deviceId) === params.deviceId)
          : null) ?? pendingRecords[pendingRecords.length - 1];
      requestId = nonEmpty(matching?.requestId);
    }

    if (!requestId) {
      return { ok: false, reason: "no pending device pairing request found" };
    }

    await client.request(
      "device.pair.approve",
      { requestId },
      {
        timeoutMs: params.connectTimeoutMs,
      },
    );

    return { ok: true, requestId };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    client.close();
  }
}

function parseUsage(value: unknown): AdapterExecutionResult["usage"] | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const inputTokens = asNumber(record.inputTokens ?? record.input, 0);
  const outputTokens = asNumber(record.outputTokens ?? record.output, 0);
  const cachedInputTokens = asNumber(
    record.cachedInputTokens ?? record.cached_input_tokens ?? record.cacheRead ?? record.cache_read,
    0,
  );

  if (inputTokens <= 0 && outputTokens <= 0 && cachedInputTokens <= 0) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    ...(cachedInputTokens > 0 ? { cachedInputTokens } : {}),
  };
}

function extractResultText(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;

  const payloads = Array.isArray(record.payloads) ? record.payloads : [];
  const texts = payloads
    .map((entry) => {
      const payload = asRecord(entry);
      return nonEmpty(payload?.text);
    })
    .filter((entry): entry is string => Boolean(entry));

  if (texts.length > 0) return texts.join("\n\n");
  return nonEmpty(record.text) ?? nonEmpty(record.summary) ?? null;
}

/** Build sessionParams from the current run context for inclusion in execution results. */
function buildSessionParams(
  sessionKey: string,
  deviceIdentity: GatewayDeviceIdentity | null,
  runId: string,
  acceptedRunId?: string,
): Record<string, unknown> {
  const params: Record<string, unknown> = { sessionKey };
  if (deviceIdentity) params.deviceId = deviceIdentity.deviceId;
  if (acceptedRunId) params.lastAgentId = acceptedRunId;
  params.lastRunId = runId;
  return params;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const urlValue = asString(ctx.config.url, "").trim();
  if (!urlValue) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "OpenClaw gateway adapter missing url",
      errorCode: "openclaw_gateway_url_missing",
    };
  }

  const parsedUrl = normalizeUrl(urlValue);
  if (!parsedUrl) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Invalid gateway URL: ${urlValue}`,
      errorCode: "openclaw_gateway_url_invalid",
    };
  }

  if (parsedUrl.protocol !== "ws:" && parsedUrl.protocol !== "wss:") {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Unsupported gateway URL protocol: ${parsedUrl.protocol}`,
      errorCode: "openclaw_gateway_url_protocol",
    };
  }

  const timeoutSec = Math.max(0, Math.floor(asNumber(ctx.config.timeoutSec, 120)));
  const timeoutMs = timeoutSec > 0 ? timeoutSec * 1000 : 0;
  const connectTimeoutMs = timeoutMs > 0 ? Math.min(timeoutMs, 15_000) : 10_000;
  const waitTimeoutMs = parseOptionalPositiveInteger(ctx.config.waitTimeoutMs) ?? (timeoutMs > 0 ? timeoutMs : 30_000);

  const payloadTemplate = parseObject(ctx.config.payloadTemplate);
  const transportHint = nonEmpty(ctx.config.streamTransport) ?? nonEmpty(ctx.config.transport);

  const headers = toStringRecord(ctx.config.headers);
  const authToken = resolveAuthToken(parseObject(ctx.config), headers);
  const password = nonEmpty(ctx.config.password);
  const deviceToken = nonEmpty(ctx.config.deviceToken);

  if (authToken && !headerMapHasIgnoreCase(headers, "authorization")) {
    headers.authorization = toAuthorizationHeaderValue(authToken);
  }

  const clientId = nonEmpty(ctx.config.clientId) ?? DEFAULT_CLIENT_ID;
  const clientMode = nonEmpty(ctx.config.clientMode) ?? DEFAULT_CLIENT_MODE;
  const clientVersion = nonEmpty(ctx.config.clientVersion) ?? DEFAULT_CLIENT_VERSION;
  const role = nonEmpty(ctx.config.role) ?? DEFAULT_ROLE;
  const scopes = normalizeScopes(ctx.config.scopes);
  const deviceFamily = nonEmpty(ctx.config.deviceFamily);
  const disableDeviceAuth = parseBoolean(ctx.config.disableDeviceAuth, false);

  const wakePayload = buildWakePayload(ctx);
  const JigongEnv = buildJiGongEnvForWake(ctx, wakePayload);

  // --- Bootstrap token minting (when useBootstrapExchange is enabled) ---
  const useBootstrapExchange = parseBoolean(ctx.config.useBootstrapExchange, false);
  let bootstrapToken: string | null = null;
  if (useBootstrapExchange) {
    const signingKey = nonEmpty(ctx.config.jwtSecret) ?? nonEmpty(ctx.config.agentJwtSecret);
    if (signingKey) {
      bootstrapToken = mintBootstrapToken({
        agentId: ctx.agent.id,
        companyId: ctx.agent.companyId,
        runId: ctx.runId,
        signingKey,
      });
    }
  }

  // --- Wake version: v2 structured payload or v1 text ---
  const wakeVersion = String(ctx.config.wakeVersion ?? "1").trim();
  const JigongApiUrl =
    resolveJiGongApiUrlOverride(ctx.config.JigongApiUrl) ??
    JigongEnv.Jigong_API_URL ??
    "https://app.Jigong.dev";

  let message: string;
  let payloadV2: Record<string, unknown> | null = null;

  // Extract agent skills from context (passed by heartbeat service)
  const agentSkills = Array.isArray(ctx.context.agentSkills) ? ctx.context.agentSkills : [];

  if (wakeVersion === "2") {
    const v2Result = buildWakePayloadV2({
      runId: ctx.runId,
      agentId: ctx.agent.id,
      companyId: ctx.agent.companyId,
      JigongApiUrl,
      bootstrapToken,
      taskId: wakePayload.taskId,
      issueId: wakePayload.issueId,
      wakeReason: wakePayload.wakeReason,
      wakeCommentId: wakePayload.wakeCommentId,
      approvalId: wakePayload.approvalId,
      approvalStatus: wakePayload.approvalStatus,
      linkedIssueIds: wakePayload.issueIds,
      agentSkills: agentSkills.length > 0 ? agentSkills : undefined,
    });
    const templateMessage = nonEmpty(payloadTemplate.message) ?? nonEmpty(payloadTemplate.text);
    message = templateMessage ? appendWakeText(templateMessage, v2Result.message) : v2Result.message;
    payloadV2 = v2Result.payload as unknown as Record<string, unknown>;
  } else {
    const wakeText = buildWakeText(wakePayload, JigongEnv);
    const templateMessage = nonEmpty(payloadTemplate.message) ?? nonEmpty(payloadTemplate.text);
    message = templateMessage ? appendWakeText(templateMessage, wakeText) : wakeText;
  }

  const sessionKeyStrategy = normalizeSessionKeyStrategy(ctx.config.sessionKeyStrategy);
  const configuredSessionKey = nonEmpty(ctx.config.sessionKey);
  const sessionKey = resolveSessionKey({
    strategy: sessionKeyStrategy,
    configuredSessionKey,
    runId: ctx.runId,
    issueId: wakePayload.issueId,
  });

  const agentParams: Record<string, unknown> = {
    ...payloadTemplate,
    message,
    sessionKey,
    idempotencyKey: ctx.runId,
    ...(payloadV2 ? { payloadV2 } : {}),
  };
  delete agentParams.text;

  const configuredAgentId = nonEmpty(ctx.config.agentId);
  if (configuredAgentId && !nonEmpty(agentParams.agentId)) {
    agentParams.agentId = configuredAgentId;
  }

  if (typeof agentParams.timeout !== "number") {
    agentParams.timeout = waitTimeoutMs;
  }

  if (ctx.onMeta) {
    await ctx.onMeta({
      adapterType: "openclaw_gateway",
      command: "gateway",
      commandArgs: ["ws", parsedUrl.toString(), "agent"],
      context: ctx.context,
    });
  }

  const outboundHeaderKeys = Object.keys(headers).sort();
  await ctx.onLog(
    "stdout",
    `[openclaw-gateway] outbound headers (redacted): ${stringifyForLog(redactForLog(headers), 4_000)}\n`,
  );
  await ctx.onLog(
    "stdout",
    `[openclaw-gateway] outbound payload (redacted): ${stringifyForLog(redactForLog(agentParams), 12_000)}\n`,
  );
  await ctx.onLog("stdout", `[openclaw-gateway] outbound header keys: ${outboundHeaderKeys.join(", ")}\n`);
  if (transportHint) {
    await ctx.onLog(
      "stdout",
      `[openclaw-gateway] ignoring streamTransport=${transportHint}; gateway adapter always uses websocket protocol\n`,
    );
  }
  if (parsedUrl.protocol === "ws:" && !isLoopbackHost(parsedUrl.hostname)) {
    await ctx.onLog(
      "stdout",
      "[openclaw-gateway] warning: using plaintext ws:// to a non-loopback host; prefer wss:// for remote endpoints\n",
    );
  }

  const autoPairOnFirstConnect = parseBoolean(ctx.config.autoPairOnFirstConnect, true);
  let autoPairAttempted = false;
  let latestResultPayload: unknown = null;

  while (true) {
    const trackedRunIds = new Set<string>([ctx.runId]);
    const assistantChunks: string[] = [];
    let lifecycleError: string | null = null;
    let deviceIdentity: GatewayDeviceIdentity | null = null;

    const onEvent = async (frame: GatewayEventFrame) => {
      if (frame.event !== "agent") {
        if (frame.event === "shutdown") {
          await ctx.onLog(
            "stdout",
            `[openclaw-gateway] gateway shutdown notice: ${stringifyForLog(frame.payload ?? {}, 2_000)}\n`,
          );
        }
        return;
      }

      const payload = asRecord(frame.payload);
      if (!payload) return;

      const runId = nonEmpty(payload.runId);
      if (!runId || !trackedRunIds.has(runId)) return;

      const stream = nonEmpty(payload.stream) ?? "unknown";
      const data = asRecord(payload.data) ?? {};
      await ctx.onLog(
        "stdout",
        `[openclaw-gateway:event] run=${runId} stream=${stream} data=${stringifyForLog(data, 8_000)}\n`,
      );

      if (stream === "assistant") {
        const delta = nonEmpty(data.delta);
        const text = nonEmpty(data.text);
        if (delta) {
          assistantChunks.push(delta);
        } else if (text) {
          assistantChunks.push(text);
        }
        return;
      }

      if (stream === "error") {
        lifecycleError = nonEmpty(data.error) ?? nonEmpty(data.message) ?? lifecycleError;
        return;
      }

      if (stream === "lifecycle") {
        const phase = nonEmpty(data.phase)?.toLowerCase();
        if (phase === "error" || phase === "failed" || phase === "cancelled") {
          lifecycleError = nonEmpty(data.error) ?? nonEmpty(data.message) ?? lifecycleError;
        }
      }
    };

    const client = new GatewayWsClient({
      url: parsedUrl.toString(),
      headers,
      onEvent,
      onLog: ctx.onLog as (stream: string, data: string) => Promise<void>,
    });

    try {
      deviceIdentity = disableDeviceAuth ? null : resolveDeviceIdentity(parseObject(ctx.config));
      if (deviceIdentity) {
        await ctx.onLog(
          "stdout",
          `[openclaw-gateway] device auth enabled keySource=${deviceIdentity.source} deviceId=${deviceIdentity.deviceId}\n`,
        );
      } else {
        await ctx.onLog("stdout", "[openclaw-gateway] device auth disabled\n");
      }

      await ctx.onLog("stdout", `[openclaw-gateway] connecting to ${parsedUrl.toString()}\n`);

      const hello = await client.connect((nonce) => {
        const signedAtMs = Date.now();
        const connectParams: Record<string, unknown> = {
          minProtocol: PROTOCOL_VERSION,
          maxProtocol: PROTOCOL_VERSION,
          client: {
            id: clientId,
            version: clientVersion,
            platform: process.platform,
            ...(deviceFamily ? { deviceFamily } : {}),
            mode: clientMode,
          },
          role,
          scopes,
          auth:
            authToken || password || deviceToken
              ? {
                  ...(authToken ? { token: authToken } : {}),
                  ...(deviceToken ? { deviceToken } : {}),
                  ...(password ? { password } : {}),
                }
              : undefined,
        };

        if (deviceIdentity) {
          const payload = buildDeviceAuthPayloadV3({
            deviceId: deviceIdentity.deviceId,
            clientId,
            clientMode,
            role,
            scopes,
            signedAtMs,
            token: authToken,
            nonce,
            platform: process.platform,
            deviceFamily,
          });
          connectParams.device = {
            id: deviceIdentity.deviceId,
            publicKey: deviceIdentity.publicKeyRawBase64Url,
            signature: signDevicePayload(deviceIdentity.privateKeyPem, payload),
            signedAt: signedAtMs,
            nonce,
          };
        }
        return connectParams;
      }, connectTimeoutMs);

      await ctx.onLog(
        "stdout",
        `[openclaw-gateway] connected protocol=${asNumber(asRecord(hello)?.protocol, PROTOCOL_VERSION)}\n`,
      );

      const acceptedPayload = await client.request<Record<string, unknown>>("agent", agentParams, {
        timeoutMs: connectTimeoutMs,
      });

      latestResultPayload = acceptedPayload;

      const acceptedStatus = nonEmpty(acceptedPayload?.status)?.toLowerCase() ?? "";
      const acceptedRunId = nonEmpty(acceptedPayload?.runId) ?? ctx.runId;
      trackedRunIds.add(acceptedRunId);

      await ctx.onLog(
        "stdout",
        `[openclaw-gateway] agent accepted runId=${acceptedRunId} status=${acceptedStatus || "unknown"}\n`,
      );

      if (acceptedStatus === "error") {
        const errorMessage =
          nonEmpty(acceptedPayload?.summary) ?? lifecycleError ?? "OpenClaw gateway agent request failed";
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage,
          errorCode: "openclaw_gateway_agent_error",
          resultJson: acceptedPayload,
          sessionParams: buildSessionParams(sessionKey, deviceIdentity, ctx.runId, acceptedRunId),
        };
      }

      if (acceptedStatus !== "ok") {
        // --- Cancellation support: register handler before agent.wait ---
        const abortController = new AbortController();

        cancellationRegistry.register(ctx.runId, async () => {
          try {
            await client.request("agent.cancel", { runId: acceptedRunId }, { timeoutMs: 5_000 });
          } catch {
            // Cancel request failure is non-fatal; we still abort locally.
          }
          abortController.abort();
        });

        try {
          const waitPayload = await raceWithAbort(
            client.request<Record<string, unknown>>(
              "agent.wait",
              { runId: acceptedRunId, timeoutMs: waitTimeoutMs },
              { timeoutMs: waitTimeoutMs + connectTimeoutMs },
            ),
            abortController.signal,
          );

          // If aborted (cancelled), return cancellation result
          if (abortController.signal.aborted || waitPayload === null) {
            return {
              exitCode: 1,
              signal: "SIGTERM",
              timedOut: false,
              errorMessage: "Run cancelled by operator",
              errorCode: "openclaw_gateway_cancelled",
              sessionParams: buildSessionParams(sessionKey, deviceIdentity, ctx.runId, acceptedRunId),
            };
          }

          latestResultPayload = waitPayload;

          const waitStatus = nonEmpty(waitPayload?.status)?.toLowerCase() ?? "";
          if (waitStatus === "timeout") {
            return {
              exitCode: 1,
              signal: null,
              timedOut: true,
              errorMessage: `OpenClaw gateway run timed out after ${waitTimeoutMs}ms`,
              errorCode: "openclaw_gateway_wait_timeout",
              resultJson: waitPayload,
              sessionParams: buildSessionParams(sessionKey, deviceIdentity, ctx.runId, acceptedRunId),
            };
          }

          if (waitStatus === "error") {
            return {
              exitCode: 1,
              signal: null,
              timedOut: false,
              errorMessage:
                nonEmpty(waitPayload?.error) ??
                lifecycleError ??
                "OpenClaw gateway run failed",
              errorCode: "openclaw_gateway_wait_error",
              resultJson: waitPayload,
              sessionParams: buildSessionParams(sessionKey, deviceIdentity, ctx.runId, acceptedRunId),
            };
          }

          if (waitStatus && waitStatus !== "ok") {
            return {
              exitCode: 1,
              signal: null,
              timedOut: false,
              errorMessage: `Unexpected OpenClaw gateway agent.wait status: ${waitStatus}`,
              errorCode: "openclaw_gateway_wait_status_unexpected",
              resultJson: waitPayload,
              sessionParams: buildSessionParams(sessionKey, deviceIdentity, ctx.runId, acceptedRunId),
            };
          }
        } finally {
          cancellationRegistry.unregister(ctx.runId);
        }
      }

      const summaryFromEvents = assistantChunks.join("").trim();
      const summaryFromPayload =
        extractResultText(asRecord(acceptedPayload?.result)) ??
        extractResultText(acceptedPayload) ??
        extractResultText(asRecord(latestResultPayload)) ??
        null;
      const summary = summaryFromEvents || summaryFromPayload || null;

      const meta = asRecord(asRecord(acceptedPayload?.result)?.meta) ?? asRecord(acceptedPayload?.meta);
      const agentMeta = asRecord(meta?.agentMeta);
      const usage = parseUsage(agentMeta?.usage ?? meta?.usage);
      const provider = nonEmpty(agentMeta?.provider) ?? nonEmpty(meta?.provider) ?? "openclaw";
      const model = nonEmpty(agentMeta?.model) ?? nonEmpty(meta?.model) ?? null;
      const costUsd = asNumber(agentMeta?.costUsd ?? meta?.costUsd, 0);

      await ctx.onLog(
        "stdout",
        `[openclaw-gateway] run completed runId=${Array.from(trackedRunIds).join(",")} status=ok\n`,
      );

      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        provider,
        ...(model ? { model } : {}),
        ...(usage ? { usage } : {}),
        ...(costUsd > 0 ? { costUsd } : {}),
        resultJson: asRecord(latestResultPayload),
        ...(summary ? { summary } : {}),
        sessionParams: buildSessionParams(sessionKey, deviceIdentity, ctx.runId, acceptedRunId),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const lower = message.toLowerCase();
      const timedOut = lower.includes("timeout");
      const pairingRequired = lower.includes("pairing required");

      if (
        pairingRequired &&
        !disableDeviceAuth &&
        autoPairOnFirstConnect &&
        !autoPairAttempted &&
        (authToken || password)
      ) {
        autoPairAttempted = true;
        const pairResult = await autoApproveDevicePairing({
          url: parsedUrl.toString(),
          headers,
          connectTimeoutMs,
          clientId,
          clientMode,
          clientVersion,
          role,
          scopes,
          authToken,
          password,
          requestId: extractPairingRequestId(err),
          deviceId: deviceIdentity?.deviceId ?? null,
          onLog: ctx.onLog,
        });
        if (pairResult.ok) {
          await ctx.onLog(
            "stdout",
            `[openclaw-gateway] auto-approved pairing request ${pairResult.requestId}; retrying\n`,
          );
          continue;
        }
        await ctx.onLog(
          "stderr",
          `[openclaw-gateway] auto-pairing failed: ${pairResult.reason}\n`,
        );
      }

      const detailedMessage = pairingRequired
        ? `${message}. Approve the pending device in OpenClaw (for example: openclaw devices approve --latest --url <gateway-ws-url> --token <gateway-token>) and retry. Ensure this agent has a persisted adapterConfig.devicePrivateKeyPem so approvals are reused.`
        : message;

      await ctx.onLog("stderr", `[openclaw-gateway] request failed: ${detailedMessage}\n`);

      return {
        exitCode: 1,
        signal: null,
        timedOut,
        errorMessage: detailedMessage,
        errorCode: timedOut
          ? "openclaw_gateway_timeout"
          : pairingRequired
            ? "openclaw_gateway_pairing_required"
            : "openclaw_gateway_request_failed",
        resultJson: asRecord(latestResultPayload),
        sessionParams: buildSessionParams(sessionKey, deviceIdentity, ctx.runId),
      };
    } finally {
      client.close();
    }
  }
}
