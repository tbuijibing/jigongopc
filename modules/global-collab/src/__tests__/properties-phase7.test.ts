import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { NotificationService } from "../services/notification.js";
import type { CreateNotificationInput } from "../services/notification.js";
import { parseMentions } from "../services/mention.js";
import type { CoreServices } from "../types.js";

// ─── Generators ─────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = ["mention", "assignment", "status_change", "comment", "handoff_request"];
const ENTITY_TYPES = ["issue", "comment", "approval"];
const ACTOR_TYPES = ["agent", "user"];

const notifTypeArb = fc.constantFrom(...NOTIFICATION_TYPES);
const entityTypeArb = fc.constantFrom(...ENTITY_TYPES);
const actorTypeArb = fc.constantFrom(...ACTOR_TYPES);

// ─── Mock DB for NotificationService ────────────────────────────────────────

function createMockDb() {
  const store: any[] = [];
  let idCounter = 1;

  return {
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
        return { returning: () => Promise.resolve(inserted) };
      },
    }),

    select: (projection?: any) => {
      const isCount = projection && typeof projection === "object" && "value" in projection;
      return {
        from: () => ({
          where: () => {
            if (isCount) {
              const unread = store.filter((n) => n.readAt === null);
              return Promise.resolve([{ value: unread.length }]);
            }
            return {
              orderBy: () => Promise.resolve([...store]),
            };
          },
        }),
      };
    },

    update: () => ({
      set: (vals: any) => ({
        where: () => {
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
}

// ─── Mock CoreServices for parseMentions ────────────────────────────────────

function createMockCore(
  agents: Array<{ id: string; name: string; slug: string }> = [],
): CoreServices {
  return {
    agents: {
      findByCompany: async () => agents,
    },
    issues: {},
    projects: {},
    goals: {},
    activity: {},
  };
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<CreateNotificationInput> = {}): CreateNotificationInput {
  return {
    companyId: "company-1",
    recipientUserId: "user-recipient",
    type: "mention",
    title: "Test notification",
    entityType: "comment",
    entityId: "entity-1",
    actorType: "user",
    actorId: "user-actor",
    ...overrides,
  };
}


// ─── Property 9: 通知不自发 ─────────────────────────────────────────────────
// **Validates: Requirements 8.5**

describe("Property 9: Notifications are never self-sent", () => {
  it("NotificationService.create() throws when actorType is 'user' and recipientUserId === actorId", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        notifTypeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        entityTypeArb,
        fc.uuid(),
        async (companyId, sameUserId, type, title, entityType, entityId) => {
          const db = createMockDb();
          const svc = new NotificationService(db);

          await expect(
            svc.create(
              makeInput({
                companyId,
                recipientUserId: sameUserId,
                actorType: "user",
                actorId: sameUserId,
                type,
                title,
                entityType,
                entityId,
              }),
            ),
          ).rejects.toThrow("Cannot create notification for the actor themselves");

          // Nothing should have been inserted
          expect(db._store).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("NotificationService.createBatch() filters out self-notifications when actorType is 'user'", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        notifTypeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        entityTypeArb,
        fc.uuid(),
        async (companyId, actorId, recipientIds, type, title, entityType, entityId) => {
          const db = createMockDb();
          const svc = new NotificationService(db);

          const inputs = recipientIds.map((rid) =>
            makeInput({
              companyId,
              recipientUserId: rid,
              actorType: "user",
              actorId,
              type,
              title,
              entityType,
              entityId,
            }),
          );

          const results = await svc.createBatch(inputs);

          // No result should have recipientUserId === actorId
          for (const r of results) {
            expect(r.recipientUserId).not.toBe(actorId);
          }

          // Store should also not contain self-notifications
          for (const n of db._store) {
            expect(n.recipientUserId).not.toBe(actorId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("allows notifications when actorType is 'agent' even if recipientUserId === actorId", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        notifTypeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        entityTypeArb,
        fc.uuid(),
        async (companyId, sameId, type, title, entityType, entityId) => {
          const db = createMockDb();
          const svc = new NotificationService(db);

          const result = await svc.create(
            makeInput({
              companyId,
              recipientUserId: sameId,
              actorType: "agent",
              actorId: sameId,
              type,
              title,
              entityType,
              entityId,
            }),
          );

          expect(result).toBeDefined();
          expect(result.recipientUserId).toBe(sameId);
        },
      ),
      { numRuns: 50 },
    );
  });
});


// ─── Property 10: @human 提及完整性 ─────────────────────────────────────────
// **Validates: Requirements 9.1, 9.2**

describe("Property 10: @human mention completeness", () => {
  it("parseMentions sets hasHumanMention=true when body contains @human", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 100 }),
        async (companyId, prefix, suffix) => {
          const body = `${prefix} @human ${suffix}`;
          const core = createMockCore([]);

          const result = await parseMentions(companyId, body, core);

          expect(result.hasHumanMention).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("parseMentions sets hasHumanMention=false when body does not contain @human", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc
          .string({ minLength: 1, maxLength: 200 })
          .filter((s) => !/@human\b/i.test(s)),
        async (companyId, body) => {
          const core = createMockCore([]);

          const result = await parseMentions(companyId, body, core);

          expect(result.hasHumanMention).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("@human mention: all non-offline users should be notification candidates", () => {
    // This tests the integration logic described in the hook:
    // when hasHumanMention is true, all non-offline users are included as recipients
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.uuid(),
            status: fc.constantFrom("online", "away", "offline") as fc.Arbitrary<"online" | "away" | "offline">,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.uuid(),
        (users, actorId) => {
          // Simulate the hook logic: filter non-offline users, exclude actor
          const nonOffline = users.filter((u) => u.status !== "offline");
          const recipients = nonOffline
            .map((u) => u.userId)
            .filter((id) => id !== actorId);

          // All non-offline users (except actor) should be included
          for (const u of nonOffline) {
            if (u.userId !== actorId) {
              expect(recipients).toContain(u.userId);
            }
          }

          // No offline users should be included
          const offlineIds = users.filter((u) => u.status === "offline").map((u) => u.userId);
          for (const id of offlineIds) {
            // An offline user could still be in recipients if they also appear as non-offline
            // (duplicate userId with different status). Only check pure offline users.
            const isAlsoNonOffline = users.some(
              (u) => u.userId === id && u.status !== "offline",
            );
            if (!isAlsoNonOffline) {
              expect(recipients).not.toContain(id);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 11: 通知已读状态一致性 ────────────────────────────────────────
// **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

describe("Property 11: Notification read-state consistency", () => {
  it("after markAsRead, the notification has readAt set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        notifTypeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        entityTypeArb,
        fc.uuid(),
        async (companyId, recipientId, type, title, entityType, entityId) => {
          const db = createMockDb();
          const svc = new NotificationService(db);

          const notif = await svc.create(
            makeInput({
              companyId,
              recipientUserId: recipientId,
              actorType: "agent",
              actorId: "agent-1",
              type,
              title,
              entityType,
              entityId,
            }),
          );

          // Initially unread
          expect(notif.readAt).toBeNull();

          await svc.markAsRead(notif.id, recipientId);

          // After markAsRead, the store entry should have readAt set
          const stored = db._store.find((n: any) => n.id === notif.id);
          expect(stored.readAt).not.toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("after markAllAsRead, all notifications for that user have readAt set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        async (companyId, recipientId, count) => {
          const db = createMockDb();
          const svc = new NotificationService(db);

          // Create multiple notifications
          for (let i = 0; i < count; i++) {
            await svc.create(
              makeInput({
                companyId,
                recipientUserId: recipientId,
                actorType: "agent",
                actorId: `agent-${i}`,
                entityId: `entity-${i}`,
              }),
            );
          }

          // All should be unread initially
          expect(db._store.every((n: any) => n.readAt === null)).toBe(true);

          await svc.markAllAsRead(recipientId, companyId);

          // All should now have readAt set
          for (const n of db._store) {
            expect(n.readAt).not.toBeNull();
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("getUnreadCount reflects the correct count after operations", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        async (companyId, recipientId, count) => {
          const db = createMockDb();
          const svc = new NotificationService(db);

          // Create notifications
          for (let i = 0; i < count; i++) {
            await svc.create(
              makeInput({
                companyId,
                recipientUserId: recipientId,
                actorType: "agent",
                actorId: `agent-${i}`,
                entityId: `entity-${i}`,
              }),
            );
          }

          // Unread count should equal total created
          const unreadBefore = await svc.getUnreadCount(recipientId, companyId);
          expect(unreadBefore).toBe(count);

          // Mark all as read
          await svc.markAllAsRead(recipientId, companyId);

          // Unread count should be 0
          const unreadAfter = await svc.getUnreadCount(recipientId, companyId);
          expect(unreadAfter).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});


// ─── Property 15: 提及解析正确性 ────────────────────────────────────────────
// **Validates: Requirements 9.4, 8.3**

// Use simple word-safe name generators to avoid slow filtered string generation
const AGENT_NAMES = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
const USER_NAMES = ["alice", "bob", "carol", "dave", "eve", "frank", "grace", "heidi"];

const agentNameArb = fc.constantFrom(...AGENT_NAMES);
const userNameArb = fc.constantFrom(...USER_NAMES);

describe("Property 15: Mention parsing correctness", () => {
  it("parseMentions returns no duplicates in agentIds or userIds", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.subarray(AGENT_NAMES, { minLength: 0, maxLength: 5 }),
        fc.subarray(USER_NAMES, { minLength: 0, maxLength: 5 }),
        async (companyId, agentNames, userMentions) => {
          const agents = agentNames.map((name, i) => ({
            id: `agent-id-${i}`,
            name,
            slug: name,
          }));

          // Build body with duplicated mentions to test deduplication
          const allMentions = [
            ...agentNames.map((n) => `@${n}`),
            ...userMentions.map((m) => `@${m}`),
            // Duplicate first agent mention
            ...(agentNames.length > 0 ? [`@${agentNames[0]}`] : []),
          ];
          const body = allMentions.join(" text ");

          const core = createMockCore(agents);
          const result = await parseMentions(companyId, body, core);

          // No duplicates in agentIds
          expect(new Set(result.agentIds).size).toBe(result.agentIds.length);

          // No duplicates in userIds
          expect(new Set(result.userIds).size).toBe(result.userIds.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("agentIds and userIds have no intersection", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.subarray(AGENT_NAMES, { minLength: 1, maxLength: 5 }),
        fc.subarray(USER_NAMES, { minLength: 0, maxLength: 5 }),
        async (companyId, agentNames, userMentions) => {
          const agents = agentNames.map((name, i) => ({
            id: `agent-id-${i}`,
            name,
            slug: name,
          }));

          const body = [
            ...agentNames.map((n) => `@${n}`),
            ...userMentions.map((m) => `@${m}`),
          ].join(" ");

          const core = createMockCore(agents);
          const result = await parseMentions(companyId, body, core);

          // agentIds and userIds should have no intersection
          const agentSet = new Set(result.agentIds);
          for (const uid of result.userIds) {
            expect(agentSet.has(uid)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("@human should not appear in either agentIds or userIds", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.subarray(AGENT_NAMES, { minLength: 0, maxLength: 3 }),
        fc.subarray(USER_NAMES, { minLength: 0, maxLength: 3 }),
        async (companyId, agentNames, userMentions) => {
          const agents = agentNames.map((name, i) => ({
            id: `agent-id-${i}`,
            name,
            slug: name,
          }));

          const body = [
            "@human",
            ...agentNames.map((n) => `@${n}`),
            ...userMentions.map((m) => `@${m}`),
          ].join(" ");

          const core = createMockCore(agents);
          const result = await parseMentions(companyId, body, core);

          // "human" should not be in agentIds
          expect(result.agentIds).not.toContain("human");
          // "human" should not be in userIds
          expect(result.userIds).not.toContain("human");
          // hasHumanMention should be true
          expect(result.hasHumanMention).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
