/**
 * NotificationService — manages notification creation, querying, and read-state.
 *
 * Validates: Requirements 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5, 12.2
 */

import { eq, and, isNull, desc, count } from "drizzle-orm";
import { modGlobalCollabNotifications } from "../schema.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  companyId: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string;
  entityId: string;
  actorType: string;
  actorId: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  companyId: string;
  recipientUserId: string;
  type: string;
  title: string;
  body?: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorId: string;
}

export interface ListOptions {
  unreadOnly?: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class NotificationService {
  constructor(private db: any) {}

  /**
   * Create a single notification.
   * Validates that recipientUserId ≠ actorId when actorType is "user".
   */
  async create(input: CreateNotificationInput): Promise<Notification> {
    // Self-notification guard (Req 8.5)
    if (input.actorType === "user" && input.recipientUserId === input.actorId) {
      throw new Error("Cannot create notification for the actor themselves");
    }

    const rows = await this.db
      .insert(modGlobalCollabNotifications)
      .values({
        companyId: input.companyId,
        recipientUserId: input.recipientUserId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        actorType: input.actorType,
        actorId: input.actorId,
      })
      .returning();

    return rows[0] as Notification;
  }

  /**
   * Create notifications in batch.
   * Filters out self-notifications (recipientUserId === actorId when actorType is "user").
   * Returns the created notifications.
   */
  async createBatch(inputs: CreateNotificationInput[]): Promise<Notification[]> {
    // Filter out self-notifications (Req 8.5)
    const filtered = inputs.filter(
      (input) => !(input.actorType === "user" && input.recipientUserId === input.actorId),
    );

    if (filtered.length === 0) return [];

    const values = filtered.map((input) => ({
      companyId: input.companyId,
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      actorType: input.actorType,
      actorId: input.actorId,
    }));

    const rows = await this.db
      .insert(modGlobalCollabNotifications)
      .values(values)
      .returning();

    return rows as Notification[];
  }

  /**
   * List notifications for a user in a company.
   * Supports unreadOnly filter (Req 10.1, 10.2).
   * Ordered by createdAt DESC.
   */
  async listForUser(
    userId: string,
    companyId: string,
    opts?: ListOptions,
  ): Promise<Notification[]> {
    const conditions = [
      eq(modGlobalCollabNotifications.companyId, companyId),
      eq(modGlobalCollabNotifications.recipientUserId, userId),
    ];

    if (opts?.unreadOnly) {
      conditions.push(isNull(modGlobalCollabNotifications.readAt));
    }

    const rows = await this.db
      .select()
      .from(modGlobalCollabNotifications)
      .where(and(...conditions))
      .orderBy(desc(modGlobalCollabNotifications.createdAt));

    return rows as Notification[];
  }

  /**
   * Mark a single notification as read (Req 10.3).
   * Ensures the user can only mark their own notifications.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db
      .update(modGlobalCollabNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(modGlobalCollabNotifications.id, notificationId),
          eq(modGlobalCollabNotifications.recipientUserId, userId),
        ),
      );
  }

  /**
   * Mark all unread notifications as read for a user in a company (Req 10.4).
   */
  async markAllAsRead(userId: string, companyId: string): Promise<void> {
    await this.db
      .update(modGlobalCollabNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(modGlobalCollabNotifications.recipientUserId, userId),
          eq(modGlobalCollabNotifications.companyId, companyId),
          isNull(modGlobalCollabNotifications.readAt),
        ),
      );
  }

  /**
   * Get the count of unread notifications for a user in a company (Req 10.5).
   */
  async getUnreadCount(userId: string, companyId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(modGlobalCollabNotifications)
      .where(
        and(
          eq(modGlobalCollabNotifications.recipientUserId, userId),
          eq(modGlobalCollabNotifications.companyId, companyId),
          isNull(modGlobalCollabNotifications.readAt),
        ),
      );

    return rows[0]?.value ?? 0;
  }
}
