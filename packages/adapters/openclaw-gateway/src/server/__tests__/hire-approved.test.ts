import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HireApprovedPayload } from "@Jigongai/adapter-utils";

// ---------------------------------------------------------------------------
// Mock GatewayWsClient before importing the module under test
// ---------------------------------------------------------------------------

const mockConnect = vi.fn();
const mockRequest = vi.fn();
const mockClose = vi.fn();

vi.mock("../utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils.js")>();
  return {
    ...actual,
    GatewayWsClient: vi.fn().mockImplementation(() => ({
      connect: mockConnect,
      request: mockRequest,
      close: mockClose,
    })),
  };
});

import { onHireApproved } from "../hire-approved.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validPayload: HireApprovedPayload = {
  companyId: "comp-1",
  agentId: "agent-1",
  agentName: "Test Agent",
  adapterType: "openclaw_gateway",
  source: "join_request",
  sourceId: "jr-1",
  approvedAt: new Date().toISOString(),
  message: "Your hire has been approved.",
};

const validConfig: Record<string, unknown> = {
  url: "wss://gateway.example.com",
  headers: { "x-openclaw-token": "secret" },
  disableDeviceAuth: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("onHireApproved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(null);
    mockRequest.mockResolvedValue(null);
  });

  // ── Success path ────────────────────────────────────────────────────────

  it("returns { ok: true } on success and closes the connection", async () => {
    const result = await onHireApproved(validPayload, validConfig);

    expect(result).toEqual({ ok: true });
    expect(mockConnect).toHaveBeenCalledOnce();
    expect(mockRequest).toHaveBeenCalledOnce();
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it("sends the correct notification message via agent request", async () => {
    await onHireApproved(validPayload, validConfig);

    const [method, params] = mockRequest.mock.calls[0];
    expect(method).toBe("agent");
    expect(params.message).toContain("Your hire at company comp-1 has been approved.");
    expect(params.message).toContain(validPayload.message);
    expect(params.sessionKey).toBe("hire-notify-agent-1");
    expect(params.idempotencyKey).toBe("hire-jr-1");
  });

  // ── URL missing ─────────────────────────────────────────────────────────

  it("returns { ok: false } when url is missing", async () => {
    const result = await onHireApproved(validPayload, { disableDeviceAuth: true });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing|invalid/i);
    // No WS interaction should happen
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
    // close should not be called since client was never created
    expect(mockClose).not.toHaveBeenCalled();
  });

  it("returns { ok: false } when url is empty string", async () => {
    const result = await onHireApproved(validPayload, { url: "", disableDeviceAuth: true });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing|invalid/i);
  });

  it("returns { ok: false } when url has unsupported protocol", async () => {
    const result = await onHireApproved(validPayload, {
      url: "http://gateway.example.com",
      disableDeviceAuth: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/protocol/i);
  });

  // ── Connection timeout ──────────────────────────────────────────────────

  it("returns { ok: false } when connect times out and still closes connection", async () => {
    mockConnect.mockRejectedValue(new Error("gateway websocket open timeout"));

    const result = await onHireApproved(validPayload, validConfig);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timeout/i);
    expect(mockClose).toHaveBeenCalledOnce();
  });

  // ── Send failure ────────────────────────────────────────────────────────

  it("returns { ok: false } when request fails and still closes connection", async () => {
    mockRequest.mockRejectedValue(new Error("gateway request timeout (agent)"));

    const result = await onHireApproved(validPayload, validConfig);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timeout/i);
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it("returns { ok: false } with error detail on send failure", async () => {
    mockRequest.mockRejectedValue(new Error("send failed"));

    const result = await onHireApproved(validPayload, validConfig);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("send failed");
    expect(result.detail).toEqual({
      agentId: "agent-1",
      source: "join_request",
    });
    expect(mockClose).toHaveBeenCalledOnce();
  });

  // ── Never throws ────────────────────────────────────────────────────────

  it("never throws — returns HireApprovedHookResult for all error paths", async () => {
    mockConnect.mockRejectedValue(new Error("unexpected error"));

    // Should not throw
    const result = await onHireApproved(validPayload, validConfig);
    expect(result).toHaveProperty("ok");
    expect(typeof result.ok).toBe("boolean");
  });

  // ── WebSocket always closed ─────────────────────────────────────────────

  it("closes WebSocket even when connect throws a non-Error value", async () => {
    mockConnect.mockRejectedValue("string error");

    const result = await onHireApproved(validPayload, validConfig);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("string error");
    expect(mockClose).toHaveBeenCalledOnce();
  });
});
