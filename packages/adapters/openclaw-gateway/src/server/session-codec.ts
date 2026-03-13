import type { AdapterSessionCodec } from "@Jigongai/adapter-utils";

/**
 * Return trimmed string if non-empty, otherwise null.
 */
export function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown): Record<string, unknown> | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return null;
    const record = raw as Record<string, unknown>;

    const sessionKey = readNonEmptyString(record.sessionKey);
    if (!sessionKey) return null;

    return {
      sessionKey,
      ...(readNonEmptyString(record.deviceId)
        ? { deviceId: readNonEmptyString(record.deviceId) }
        : {}),
      ...(readNonEmptyString(record.lastAgentId)
        ? { lastAgentId: readNonEmptyString(record.lastAgentId) }
        : {}),
      ...(readNonEmptyString(record.lastRunId)
        ? { lastRunId: readNonEmptyString(record.lastRunId) }
        : {}),
    };
  },

  serialize(
    params: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!params) return null;

    const sessionKey = readNonEmptyString(params.sessionKey);
    if (!sessionKey) return null;

    return {
      sessionKey,
      ...(readNonEmptyString(params.deviceId)
        ? { deviceId: readNonEmptyString(params.deviceId) }
        : {}),
      ...(readNonEmptyString(params.lastAgentId)
        ? { lastAgentId: readNonEmptyString(params.lastAgentId) }
        : {}),
      ...(readNonEmptyString(params.lastRunId)
        ? { lastRunId: readNonEmptyString(params.lastRunId) }
        : {}),
    };
  },

  getDisplayId(
    params: Record<string, unknown> | null,
  ): string | null {
    if (!params) return null;
    return readNonEmptyString(params.sessionKey);
  },
};
