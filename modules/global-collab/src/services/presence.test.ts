import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PresenceManager } from "./presence.js";

describe("PresenceManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("heartbeat + getPresence", () => {
    it("marks user as online immediately after heartbeat", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");

      const list = pm.getPresence("company-1");
      expect(list).toHaveLength(1);
      expect(list[0].userId).toBe("user-1");
      expect(list[0].status).toBe("online");
      expect(list[0].lastSeenAt).toBeInstanceOf(Date);
    });

    it("marks user as away after awayThreshold elapsed", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");

      // Advance 31 seconds (past default 30s away threshold)
      vi.advanceTimersByTime(31_000);

      const list = pm.getPresence("company-1");
      expect(list).toHaveLength(1);
      expect(list[0].status).toBe("away");
    });

    it("marks user as offline after offlineThreshold elapsed", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");

      // Advance 121 seconds (past default 120s offline threshold)
      vi.advanceTimersByTime(121_000);

      const list = pm.getPresence("company-1");
      expect(list).toHaveLength(1);
      expect(list[0].status).toBe("offline");
    });
  });

  describe("getPresence for unknown company", () => {
    it("returns empty array for unknown company", () => {
      const pm = new PresenceManager({});
      const list = pm.getPresence("unknown-company");
      expect(list).toEqual([]);
    });
  });

  describe("getUserPresence", () => {
    it("returns null for unknown user", () => {
      const pm = new PresenceManager({});
      const result = pm.getUserPresence("unknown-user", "company-1");
      expect(result).toBeNull();
    });

    it("returns null for unknown company", () => {
      const pm = new PresenceManager({});
      const result = pm.getUserPresence("user-1", "unknown-company");
      expect(result).toBeNull();
    });

    it("returns presence for a known user", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");

      const result = pm.getUserPresence("user-1", "company-1");
      expect(result).not.toBeNull();
      expect(result!.userId).toBe("user-1");
      expect(result!.status).toBe("online");
    });

    it("computes away status for single user", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");

      vi.advanceTimersByTime(31_000);

      const result = pm.getUserPresence("user-1", "company-1");
      expect(result!.status).toBe("away");
    });

    it("computes offline status for single user", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");

      vi.advanceTimersByTime(121_000);

      const result = pm.getUserPresence("user-1", "company-1");
      expect(result!.status).toBe("offline");
    });
  });

  describe("multiple users in same company", () => {
    it("tracks users independently", () => {
      const pm = new PresenceManager({});

      pm.heartbeat("user-1", "company-1");
      vi.advanceTimersByTime(31_000);
      // user-1 is now "away", user-2 heartbeats now
      pm.heartbeat("user-2", "company-1");

      const list = pm.getPresence("company-1");
      expect(list).toHaveLength(2);

      const user1 = list.find((u) => u.userId === "user-1");
      const user2 = list.find((u) => u.userId === "user-2");

      expect(user1!.status).toBe("away");
      expect(user2!.status).toBe("online");
    });
  });

  describe("custom thresholds from config", () => {
    it("respects custom awayThreshold", () => {
      const pm = new PresenceManager({
        presenceAwayThresholdMs: 5_000, // 5 seconds
        presenceOfflineThresholdMs: 10_000, // 10 seconds
      });

      pm.heartbeat("user-1", "company-1");

      // At 4s → still online
      vi.advanceTimersByTime(4_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("online");

      // At 6s → away
      vi.advanceTimersByTime(2_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("away");

      // At 11s → offline
      vi.advanceTimersByTime(5_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("offline");
    });

    it("uses defaults when config values are not numbers", () => {
      const pm = new PresenceManager({
        presenceAwayThresholdMs: "not-a-number",
        presenceOfflineThresholdMs: null,
      });

      pm.heartbeat("user-1", "company-1");

      // Default away = 30s, so at 29s still online
      vi.advanceTimersByTime(29_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("online");

      // At 31s → away (default threshold)
      vi.advanceTimersByTime(2_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("away");
    });
  });

  describe("heartbeat refreshes status", () => {
    it("resets user from away back to online on new heartbeat", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");

      // Go to away
      vi.advanceTimersByTime(31_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("away");

      // New heartbeat brings back to online
      pm.heartbeat("user-1", "company-1");
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("online");
    });

    it("resets user from offline back to online on new heartbeat", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");

      // Go to offline
      vi.advanceTimersByTime(121_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("offline");

      // New heartbeat brings back to online
      pm.heartbeat("user-1", "company-1");
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("online");
    });
  });

  describe("company isolation", () => {
    it("does not leak presence across companies", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-A");
      pm.heartbeat("user-2", "company-B");

      const listA = pm.getPresence("company-A");
      const listB = pm.getPresence("company-B");

      expect(listA).toHaveLength(1);
      expect(listA[0].userId).toBe("user-1");

      expect(listB).toHaveLength(1);
      expect(listB[0].userId).toBe("user-2");
    });
  });

  describe("boundary conditions", () => {
    it("status is online at exactly 0ms elapsed", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");
      // No time advance
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("online");
    });

    it("status is online at exactly awayThreshold - 1ms", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");
      vi.advanceTimersByTime(29_999);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("online");
    });

    it("status is away at exactly awayThreshold", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");
      vi.advanceTimersByTime(30_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("away");
    });

    it("status is away at exactly offlineThreshold - 1ms", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");
      vi.advanceTimersByTime(119_999);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("away");
    });

    it("status is offline at exactly offlineThreshold", () => {
      const pm = new PresenceManager({});
      pm.heartbeat("user-1", "company-1");
      vi.advanceTimersByTime(120_000);
      expect(pm.getUserPresence("user-1", "company-1")!.status).toBe("offline");
    });
  });
});
