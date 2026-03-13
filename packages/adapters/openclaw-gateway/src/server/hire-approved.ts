import type { HireApprovedPayload, HireApprovedHookResult } from "@Jigongai/adapter-utils";
import { parseObject } from "@Jigongai/adapter-utils/server-utils";

import {
  nonEmpty,
  parseBoolean,
  toStringRecord,
  headerMapHasIgnoreCase,
  toAuthorizationHeaderValue,
  resolveAuthToken,
  normalizeUrl,
  resolveDeviceIdentity,
  GatewayWsClient,
  buildConnectParams,
  noop,
  type GatewayClientOptions,
} from "./utils.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONNECT_TIMEOUT_MS = 10_000;
const SEND_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// onHireApproved
// ---------------------------------------------------------------------------

export async function onHireApproved(
  payload: HireApprovedPayload,
  adapterConfig: Record<string, unknown>,
): Promise<HireApprovedHookResult> {
  // Step 1: Parse config
  const urlValue = nonEmpty(adapterConfig.url);
  if (!urlValue) return { ok: false, error: "missing or invalid gateway url" };

  const parsedUrl = normalizeUrl(urlValue);
  if (!parsedUrl) return { ok: false, error: "missing or invalid gateway url" };

  if (parsedUrl.protocol !== "ws:" && parsedUrl.protocol !== "wss:") {
    return { ok: false, error: `unsupported gateway url protocol: ${parsedUrl.protocol}` };
  }

  const headers = toStringRecord(adapterConfig.headers);
  const authToken = resolveAuthToken(adapterConfig, headers);
  const password = nonEmpty(adapterConfig.password);
  const disableDeviceAuth = parseBoolean(adapterConfig.disableDeviceAuth, false);

  if (authToken && !headerMapHasIgnoreCase(headers, "authorization")) {
    headers.authorization = toAuthorizationHeaderValue(authToken);
  }

  // Step 2: Build notification message
  const notificationMessage = [
    `Your hire at company ${payload.companyId} has been approved.`,
    payload.message,
  ].join("\n");

  // Step 3: Connect and send notification
  const client = new GatewayWsClient({
    url: parsedUrl.toString(),
    headers,
    onEvent: noop,
    onLog: noop as unknown as GatewayClientOptions["onLog"],
  });

  try {
    const deviceIdentity = disableDeviceAuth ? null : resolveDeviceIdentity(parseObject(adapterConfig));

    await client.connect(
      buildConnectParams(deviceIdentity, authToken, password),
      CONNECT_TIMEOUT_MS,
    );

    await client.request("agent", {
      message: notificationMessage,
      sessionKey: `hire-notify-${payload.agentId}`,
      idempotencyKey: `hire-${payload.sourceId}`,
    }, { timeoutMs: SEND_TIMEOUT_MS });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      detail: { agentId: payload.agentId, source: payload.source },
    };
  } finally {
    client.close();
  }
}
