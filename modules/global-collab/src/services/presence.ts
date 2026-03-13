/**
 * PresenceManager — pure in-memory presence tracking.
 *
 * Tracks user online/away/offline status per company using heartbeats.
 * Status is computed dynamically based on elapsed time since last heartbeat:
 *   - elapsed < awayThresholdMs  → "online"
 *   - elapsed < offlineThresholdMs → "away"
 *   - else → "offline"
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

export interface UserPresenceInfo {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: Date;
}

interface PresenceEntry {
  lastSeen: Date;
}

const DEFAULT_AWAY_THRESHOLD_MS = 30_000; // 30 seconds
const DEFAULT_OFFLINE_THRESHOLD_MS = 120_000; // 120 seconds

export class PresenceManager {
  /** companyId → (userId → entry) */
  private store = new Map<string, Map<string, PresenceEntry>>();
  private readonly awayThresholdMs: number;
  private readonly offlineThresholdMs: number;

  constructor(config: Record<string, unknown>) {
    this.awayThresholdMs =
      typeof config.presenceAwayThresholdMs === "number"
        ? config.presenceAwayThresholdMs
        : DEFAULT_AWAY_THRESHOLD_MS;

    this.offlineThresholdMs =
      typeof config.presenceOfflineThresholdMs === "number"
        ? config.presenceOfflineThresholdMs
        : DEFAULT_OFFLINE_THRESHOLD_MS;
  }

  /**
   * Record a heartbeat for a user in a company.
   * Sets lastSeen to current time → status becomes "online".
   * Validates: Requirement 11.1
   */
  heartbeat(userId: string, companyId: string): void {
    let companyMap = this.store.get(companyId);
    if (!companyMap) {
      companyMap = new Map();
      this.store.set(companyId, companyMap);
    }
    companyMap.set(userId, { lastSeen: new Date() });
  }

  /**
   * Get presence for all known users in a company.
   * Status is computed based on elapsed time since last heartbeat.
   * Validates: Requirements 11.2, 11.3, 11.4
   */
  getPresence(
    companyId: string,
  ): Array<UserPresenceInfo> {
    const companyMap = this.store.get(companyId);
    if (!companyMap) return [];

    const now = Date.now();
    const result: UserPresenceInfo[] = [];

    for (const [userId, entry] of companyMap) {
      result.push({
        userId,
        status: this.computeStatus(now, entry.lastSeen),
        lastSeenAt: entry.lastSeen,
      });
    }

    return result;
  }

  /**
   * Get presence for a single user in a company.
   * Returns null if the user has never sent a heartbeat for this company.
   */
  getUserPresence(
    userId: string,
    companyId: string,
  ): UserPresenceInfo | null {
    const companyMap = this.store.get(companyId);
    if (!companyMap) return null;

    const entry = companyMap.get(userId);
    if (!entry) return null;

    const now = Date.now();
    return {
      userId,
      status: this.computeStatus(now, entry.lastSeen),
      lastSeenAt: entry.lastSeen,
    };
  }

  /** Compute status from elapsed milliseconds. */
  private computeStatus(
    nowMs: number,
    lastSeen: Date,
  ): "online" | "away" | "offline" {
    const elapsed = nowMs - lastSeen.getTime();
    if (elapsed < this.awayThresholdMs) return "online";
    if (elapsed < this.offlineThresholdMs) return "away";
    return "offline";
  }
}
