import { describe, it, expect } from "vitest";
import { NotificationService } from "./notification.js";
import type { CreateNotificationInput } from "./notification.js";

// ─── Mock DB ────────────────────────────────────────────────────────────────

function createMockDb() {
  // Stores all inserted notifications
  const store: any[] = [];
  let idCounter = 1;

  const db = {
    _store: store,

    insert: () => ({
      values: (vals: any) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        const inserted = rows.map((v: any) => ({
          id: `notif-${idCounter++}`,
          ...v,
          body: v.body ?? null,
          readAt: null,
          createdAt: new Date(),
        }));
        store.push(...inserted);
        return {
          returning: () => Promise.resolve(inserted),
        };
      },
    }),

    select: (projection?: any) => ({
      from: () => ({
        where: (_cond: any) => ({
          orderBy: () => {
            // listForUser: return all store items (filtering is mocked at a higher level)
            return Promise.resolve(store);
          },
        }),
      }),
    }),

    update: () => ({
      set: (_vals: any) => ({
        where: (_cond: any) => Promise.resolve(),
      }),
    }),
  };

  return db;
}

/**
 * A more sophisticated mock that supports filtering for listForUser / getUnreadCount.
 */
function createFilterableMockDb() {
  const store: any[] = [];
  let idCounter = 1;

  const db = {
    _store: store,

    insert: () => ({
      values: (vals: any) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        const inserted = rows.map((v: any) => ({
          id: `notif-${idCounter++}`,
          ...v,
          body: v.body ?? null,
          readAt: null,
          createdAt: new Date(),
        }));
        store.push(...inserted);
        return {
          returning: () => Promise.resolve(inserted),
        };
      },
    }),

    select: (projection?: any) => {
      const isCount = projection && typeof projection === "object" && "value" in projection;
      return {
        from: () => ({
          where: () => {
            if (isCount) {
              // getUnreadCount: count unread items
              const unread = store.filter((n) => n.readAt === null);
              return Promise.resolve([{ value: unread.length }]);
            }
            return {
              orderBy: () => {
                // listForUser: return all (tests control store contents)
                return Promise.resolve([...store]);
              },
            };
          },
        }),
      };
    },

    update: () => ({
      set: (vals: any) => ({
        where: () => {
          // markAsRead / markAllAsRead: update readAt in store
          for (const n of store) {
            if (n.readAt === null) {
              n.readAt = vals.readAt;
            }
          }
          return Promise.resolve();
        },
      }),
    }),
  };

  return db;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<CreateNotificationInput> = {}): CreateNotificationInput {
  return {
    companyId: "company-1",
    recipientUserId: "user-recipient",
    type: "mention",
    title: "You were mentioned",
    entityType: "comment",
    entityId: "comment-1",
    actorType: "user",
    actorId: "user-actor",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("NotificationService", () => {
  describe("create", () => {
    it("creates a notification and returns it", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      const result = await svc.create(makeInput());

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.recipientUserId).toBe("user-recipient");
      expect(result.type).toBe("mention");
      expect(result.title).toBe("You were mentioned");
      expect(result.readAt).toBeNull();
    });

    it("throws when recipientUserId equals actorId for user actor", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      await expect(
        svc.create(makeInput({ recipientUserId: "same-user", actorId: "same-user" })),
      ).rejects.toThrow("Cannot create notification for the actor themselves");
    });

    it("allows recipientUserId equals actorId when actorType is agent", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      // actorType "agent" should not trigger the self-notification guard
      const result = await svc.create(
        makeInput({
          recipientUserId: "user-1",
          actorType: "agent",
          actorId: "user-1",
        }),
      );

      expect(result).toBeDefined();
      expect(result.recipientUserId).toBe("user-1");
    });

    it("sets body to null when not provided", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      const result = await svc.create(makeInput());
      expect(result.body).toBeNull();
    });

    it("preserves body when provided", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      const result = await svc.create(makeInput({ body: "Some body text" }));
      expect(result.body).toBe("Some body text");
    });
  });

  describe("createBatch", () => {
    it("creates multiple notifications", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      const inputs = [
        makeInput({ recipientUserId: "user-1" }),
        makeInput({ recipientUserId: "user-2" }),
      ];

      const results = await svc.createBatch(inputs);

      expect(results).toHaveLength(2);
      expect(results[0].recipientUserId).toBe("user-1");
      expect(results[1].recipientUserId).toBe("user-2");
    });

    it("filters out self-notifications from batch", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      const inputs = [
        makeInput({ recipientUserId: "user-1", actorId: "user-actor" }),
        makeInput({ recipientUserId: "user-actor", actorId: "user-actor" }), // self → filtered
        makeInput({ recipientUserId: "user-2", actorId: "user-actor" }),
      ];

      const results = await svc.createBatch(inputs);

      expect(results).toHaveLength(2);
      expect(results.map((r: any) => r.recipientUserId)).toEqual(["user-1", "user-2"]);
    });

    it("returns empty array when all inputs are self-notifications", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      const inputs = [
        makeInput({ recipientUserId: "user-actor", actorId: "user-actor" }),
      ];

      const results = await svc.createBatch(inputs);
      expect(results).toHaveLength(0);
    });

    it("returns empty array for empty input", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      const results = await svc.createBatch([]);
      expect(results).toHaveLength(0);
    });

    it("does not filter agent self-notifications", async () => {
      const db = createMockDb();
      const svc = new NotificationService(db);

      const inputs = [
        makeInput({
          recipientUserId: "agent-1",
          actorType: "agent",
          actorId: "agent-1",
        }),
      ];

      const results = await svc.createBatch(inputs);
      expect(results).toHaveLength(1);
    });
  });

  describe("listForUser", () => {
    it("returns notifications from the store", async () => {
      const db = createFilterableMockDb();
      const svc = new NotificationService(db);

      // Pre-populate store
      await svc.create(makeInput({ recipientUserId: "user-1" }));
      await svc.create(makeInput({ recipientUserId: "user-1" }));

      const results = await svc.listForUser("user-1", "company-1");
      expect(results).toHaveLength(2);
    });

    it("accepts unreadOnly option without error", async () => {
      const db = createFilterableMockDb();
      const svc = new NotificationService(db);

      await svc.create(makeInput({ recipientUserId: "user-1" }));

      // Should not throw
      const results = await svc.listForUser("user-1", "company-1", { unreadOnly: true });
      expect(results).toBeDefined();
    });
  });

  describe("markAsRead", () => {
    it("calls update without error", async () => {
      const db = createFilterableMockDb();
      const svc = new NotificationService(db);

      await svc.create(makeInput({ recipientUserId: "user-1" }));

      // Should not throw
      await expect(svc.markAsRead("notif-1", "user-1")).resolves.toBeUndefined();
    });
  });

  describe("markAllAsRead", () => {
    it("marks all unread notifications as read", async () => {
      const db = createFilterableMockDb();
      const svc = new NotificationService(db);

      await svc.create(makeInput({ recipientUserId: "user-1" }));
      await svc.create(makeInput({ recipientUserId: "user-1" }));

      await svc.markAllAsRead("user-1", "company-1");

      // All items in store should now have readAt set
      for (const n of db._store) {
        expect(n.readAt).not.toBeNull();
      }
    });
  });

  describe("getUnreadCount", () => {
    it("returns count of unread notifications", async () => {
      const db = createFilterableMockDb();
      const svc = new NotificationService(db);

      await svc.create(makeInput({ recipientUserId: "user-1" }));
      await svc.create(makeInput({ recipientUserId: "user-1" }));

      const count = await svc.getUnreadCount("user-1", "company-1");
      expect(count).toBe(2);
    });

    it("returns 0 when no notifications exist", async () => {
      const db = createFilterableMockDb();
      const svc = new NotificationService(db);

      const count = await svc.getUnreadCount("user-1", "company-1");
      expect(count).toBe(0);
    });

    it("returns 0 after all are marked as read", async () => {
      const db = createFilterableMockDb();
      const svc = new NotificationService(db);

      await svc.create(makeInput({ recipientUserId: "user-1" }));
      await svc.markAllAsRead("user-1", "company-1");

      const count = await svc.getUnreadCount("user-1", "company-1");
      expect(count).toBe(0);
    });
  });
});
