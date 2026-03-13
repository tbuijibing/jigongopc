import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { PresenceManager } from "../services/presence.js";

// ─── Property 12: 在线状态阈值正确性 ───────────────────────────────────────
// **Validates: Requirements 11.1, 11.2, 11.3**

describe("Property 12: Presence threshold correctness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("elapsed < awayThreshold → online, awayThreshold <= elapsed < offlineThreshold → away, elapsed >= offlineThreshold → offline", () => {
    fc.assert(
      fc.property(
        // Generate random thresholds where away < offline
        fc.integer({ min: 1000, max: 60000 }),
        fc.integer({ min: 1000, max: 60000 }),
        fc.uuid(),
        fc.uuid(),
        (awayMs, extraMs, userId, companyId) => {
          const offlineMs = awayMs + extraMs; // guarantees offline > away

          const pm = new PresenceManager({
            presenceAwayThresholdMs: awayMs,
            presenceOfflineThresholdMs: offlineMs,
          });

          // Reset fake timers to a known point
          vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

          pm.heartbeat(userId, companyId);

          // Region 1: elapsed = 0 → online
          const presenceNow = pm.getUserPresence(userId, companyId);
          expect(presenceNow).not.toBeNull();
          expect(presenceNow!.status).toBe("online");

          // Advance to middle of online region (half of awayThreshold)
          if (awayMs > 2) {
            vi.advanceTimersByTime(Math.floor(awayMs / 2));
            expect(pm.getUserPresence(userId, companyId)!.status).toBe("online");
          }

          // Reset: new heartbeat
          vi.setSystemTime(new Date("2025-01-01T01:00:00Z"));
          pm.heartbeat(userId, companyId);

          // Region 2: advance exactly to awayThreshold → away
          vi.advanceTimersByTime(awayMs);
          expect(pm.getUserPresence(userId, companyId)!.status).toBe("away");

          // Advance to middle of away region
          if (extraMs > 2) {
            vi.advanceTimersByTime(Math.floor(extraMs / 2));
            const midAway = pm.getUserPresence(userId, companyId)!.status;
            // Should still be away (not yet offline)
            expect(midAway).toBe("away");
          }

          // Reset: new heartbeat
          vi.setSystemTime(new Date("2025-01-01T02:00:00Z"));
          pm.heartbeat(userId, companyId);

          // Region 3: advance to offlineThreshold → offline
          vi.advanceTimersByTime(offlineMs);
          expect(pm.getUserPresence(userId, companyId)!.status).toBe("offline");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("for random elapsed times, status matches the correct threshold region", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 60000 }),
        fc.integer({ min: 1000, max: 60000 }),
        fc.integer({ min: 0, max: 180000 }),
        fc.uuid(),
        fc.uuid(),
        (awayMs, extraMs, elapsed, userId, companyId) => {
          const offlineMs = awayMs + extraMs;

          const pm = new PresenceManager({
            presenceAwayThresholdMs: awayMs,
            presenceOfflineThresholdMs: offlineMs,
          });

          vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
          pm.heartbeat(userId, companyId);
          vi.advanceTimersByTime(elapsed);

          const presence = pm.getUserPresence(userId, companyId)!;
          expect(presence).not.toBeNull();

          if (elapsed < awayMs) {
            expect(presence.status).toBe("online");
          } else if (elapsed < offlineMs) {
            expect(presence.status).toBe("away");
          } else {
            expect(presence.status).toBe("offline");
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("heartbeat always resets status to online regardless of previous state", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 60000 }),
        fc.integer({ min: 1000, max: 60000 }),
        fc.integer({ min: 0, max: 200000 }),
        fc.uuid(),
        fc.uuid(),
        (awayMs, extraMs, elapsed, userId, companyId) => {
          const offlineMs = awayMs + extraMs;

          const pm = new PresenceManager({
            presenceAwayThresholdMs: awayMs,
            presenceOfflineThresholdMs: offlineMs,
          });

          vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
          pm.heartbeat(userId, companyId);

          // Advance to some arbitrary elapsed time (could be online, away, or offline)
          vi.advanceTimersByTime(elapsed);

          // Send a new heartbeat — should always reset to online
          pm.heartbeat(userId, companyId);
          const presence = pm.getUserPresence(userId, companyId)!;
          expect(presence).not.toBeNull();
          expect(presence.status).toBe("online");
        },
      ),
      { numRuns: 200 },
    );
  });
});
