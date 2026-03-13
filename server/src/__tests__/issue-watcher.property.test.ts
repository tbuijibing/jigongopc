import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { WATCHER_TYPES } from "@jigongai/shared";

/**
 * Property 13: Watcher notification on status change
 *
 * For any Issue with Watchers, when the Issue status changes, every
 * agent-type Watcher SHALL receive a Wakeup_Request, and every user-type
 * Watcher SHALL have a notification event recorded.
 *
 * Modelled as pure functions (no DB needed) following the pattern in
 * issue-dependency.property.test.ts and issue-type.property.test.ts.
 *
 * **Validates: Requirements 10.3, 10.4, 13.1, 13.2, 13.3**
 */

// ── Types ───────────────────────────────────────────────────────────────────

type WatcherType = (typeof WATCHER_TYPES)[number];

interface Watcher {
  id: string;
  issueId: string;
  companyId: string;
  watcherType: WatcherType;
  watcherId: string; // agentId or userId
}

interface WakeupRequest {
  companyId: string;
  agentId: string;
  source: string;
  issueId: string;
  newStatus: string;
}

interface UserNotification {
  userId: string;
  issueId: string;
  newStatus: string;
}

interface NotificationResult {
  wakeupRequests: WakeupRequest[];
  userNotifications: UserNotification[];
}

// ── Pure notification logic (mirrors IssueWatcherService.notifyWatchers) ────

/**
 * Pure-function equivalent of notifyWatchers in issue-watchers.ts.
 *
 * Given a list of watchers for an issue and a status change event,
 * produces WakeupRequests for agent watchers and notification events
 * for user watchers.
 */
function notifyWatchers(
  watchers: Watcher[],
  issueId: string,
  companyId: string,
  newStatus: string,
): NotificationResult {
  const wakeupRequests: WakeupRequest[] = [];
  const userNotifications: UserNotification[] = [];

  for (const watcher of watchers) {
    if (watcher.issueId !== issueId) continue;

    if (watcher.watcherType === "agent") {
      wakeupRequests.push({
        companyId,
        agentId: watcher.watcherId,
        source: "watcher",
        issueId,
        newStatus,
      });
    } else if (watcher.watcherType === "user") {
      userNotifications.push({
        userId: watcher.watcherId,
        issueId,
        newStatus,
      });
    }
  }

  return { wakeupRequests, userNotifications };
}

// ── Generators ──────────────────────────────────────────────────────────────

const companyIdArb = fc.constantFrom("company-1", "company-2", "company-3");
const issueIdArb = fc.constantFrom("issue-1", "issue-2", "issue-3", "issue-4");
const watcherIdArb = fc.constantFrom(
  "agent-A", "agent-B", "agent-C",
  "user-X", "user-Y", "user-Z",
);
const watcherTypeArb: fc.Arbitrary<WatcherType> = fc.constantFrom(...WATCHER_TYPES);
const statusArb = fc.constantFrom("open", "in_progress", "done", "blocked", "cancelled");

/** Generate a single watcher record */
const watcherArb: fc.Arbitrary<Watcher> = fc.record({
  id: fc.uuid(),
  issueId: issueIdArb,
  companyId: companyIdArb,
  watcherType: watcherTypeArb,
  watcherId: watcherIdArb,
});

/** Generate a list of watchers, possibly for multiple issues */
const watcherListArb = fc.array(watcherArb, { minLength: 0, maxLength: 20 });

// ── Property 13: Watcher notification on status change ──────────────────────

describe("Property 13: Watcher notification on status change — agent watcher gets WakeupRequest, user watcher gets notification event", () => {
  it("every agent watcher for the issue produces exactly one WakeupRequest", () => {
    fc.assert(
      fc.property(
        watcherListArb,
        issueIdArb,
        companyIdArb,
        statusArb,
        (watchers, issueId, companyId, newStatus) => {
          const result = notifyWatchers(watchers, issueId, companyId, newStatus);

          const agentWatchers = watchers.filter(
            (w) => w.issueId === issueId && w.watcherType === "agent",
          );

          // One WakeupRequest per agent watcher
          expect(result.wakeupRequests.length).toBe(agentWatchers.length);

          // Each agent watcher's watcherId appears in the wakeup requests
          for (const aw of agentWatchers) {
            const found = result.wakeupRequests.some(
              (wr) => wr.agentId === aw.watcherId && wr.issueId === issueId,
            );
            expect(found).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("every user watcher for the issue produces exactly one notification event", () => {
    fc.assert(
      fc.property(
        watcherListArb,
        issueIdArb,
        companyIdArb,
        statusArb,
        (watchers, issueId, companyId, newStatus) => {
          const result = notifyWatchers(watchers, issueId, companyId, newStatus);

          const userWatchers = watchers.filter(
            (w) => w.issueId === issueId && w.watcherType === "user",
          );

          // One notification per user watcher
          expect(result.userNotifications.length).toBe(userWatchers.length);

          // Each user watcher's watcherId appears in the notifications
          for (const uw of userWatchers) {
            const found = result.userNotifications.some(
              (n) => n.userId === uw.watcherId && n.issueId === issueId,
            );
            expect(found).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("no watcher is missed: total outputs = agent watchers + user watchers for the issue", () => {
    fc.assert(
      fc.property(
        watcherListArb,
        issueIdArb,
        companyIdArb,
        statusArb,
        (watchers, issueId, companyId, newStatus) => {
          const result = notifyWatchers(watchers, issueId, companyId, newStatus);

          const relevantWatchers = watchers.filter((w) => w.issueId === issueId);
          const totalOutputs =
            result.wakeupRequests.length + result.userNotifications.length;

          expect(totalOutputs).toBe(relevantWatchers.length);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("watchers for other issues are not notified", () => {
    fc.assert(
      fc.property(
        watcherListArb,
        issueIdArb,
        companyIdArb,
        statusArb,
        (watchers, issueId, companyId, newStatus) => {
          const result = notifyWatchers(watchers, issueId, companyId, newStatus);

          // All wakeup requests reference the correct issueId
          for (const wr of result.wakeupRequests) {
            expect(wr.issueId).toBe(issueId);
          }

          // All user notifications reference the correct issueId
          for (const n of result.userNotifications) {
            expect(n.issueId).toBe(issueId);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("WakeupRequests carry correct companyId and newStatus", () => {
    fc.assert(
      fc.property(
        watcherListArb,
        issueIdArb,
        companyIdArb,
        statusArb,
        (watchers, issueId, companyId, newStatus) => {
          const result = notifyWatchers(watchers, issueId, companyId, newStatus);

          for (const wr of result.wakeupRequests) {
            expect(wr.companyId).toBe(companyId);
            expect(wr.newStatus).toBe(newStatus);
            expect(wr.source).toBe("watcher");
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("user notifications carry correct newStatus", () => {
    fc.assert(
      fc.property(
        watcherListArb,
        issueIdArb,
        companyIdArb,
        statusArb,
        (watchers, issueId, companyId, newStatus) => {
          const result = notifyWatchers(watchers, issueId, companyId, newStatus);

          for (const n of result.userNotifications) {
            expect(n.newStatus).toBe(newStatus);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("empty watcher list produces no notifications", () => {
    fc.assert(
      fc.property(
        issueIdArb,
        companyIdArb,
        statusArb,
        (issueId, companyId, newStatus) => {
          const result = notifyWatchers([], issueId, companyId, newStatus);
          expect(result.wakeupRequests.length).toBe(0);
          expect(result.userNotifications.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("agent and user watchers are routed to the correct output channel (no cross-contamination)", () => {
    fc.assert(
      fc.property(
        watcherListArb,
        issueIdArb,
        companyIdArb,
        statusArb,
        (watchers, issueId, companyId, newStatus) => {
          const result = notifyWatchers(watchers, issueId, companyId, newStatus);

          const agentWatcherIds = new Set(
            watchers
              .filter((w) => w.issueId === issueId && w.watcherType === "agent")
              .map((w) => w.watcherId),
          );
          const userWatcherIds = new Set(
            watchers
              .filter((w) => w.issueId === issueId && w.watcherType === "user")
              .map((w) => w.watcherId),
          );

          // WakeupRequests only contain agent watcher IDs
          for (const wr of result.wakeupRequests) {
            expect(agentWatcherIds.has(wr.agentId)).toBe(true);
          }

          // User notifications only contain user watcher IDs
          for (const n of result.userNotifications) {
            expect(userWatcherIds.has(n.userId)).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
