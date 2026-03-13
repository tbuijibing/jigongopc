// Stub — full implementation in Task 1.5 / 3.2 / 4.3 / 5.4 / 7.6 / 8.2
import { Router, json } from "express";
import type { Request } from "express";
import type { CoreServices } from "./types.js";
import type { PresenceManager } from "./services/presence.js";
import type { DictionaryTranslationCache } from "./services/dictionary-cache.js";
import { UserPreferencesService, ValidationError } from "./services/user-preferences.js";
import { TranslationService } from "./services/translation.js";
import { NotificationService } from "./services/notification.js";
import { modGlobalCollabDictionaryTranslations, modGlobalCollabEntityTranslations } from "./schema.js";
import { eq, and } from "drizzle-orm";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getContext(req: Request): { userId: string; companyId: string } {
  const userId = req.headers["x-user-id"] as string;
  const companyId = req.headers["x-company-id"] as string;
  if (!userId || !companyId) {
    throw Object.assign(new Error("Missing x-user-id or x-company-id header"), { status: 401 });
  }
  return { userId, companyId };
}

/**
 * Create the module router with all route groups.
 * Routes are mounted under /api/modules/global-collab/ by the module loader.
 */
export function createRouter(
  db: any,
  config: Record<string, unknown>,
  _core: CoreServices,
  _presenceManager: PresenceManager,
  _dictionaryCache: DictionaryTranslationCache,
): Router {
  const router = Router();
  router.use(json());

  // === User Preferences ===
  router.get("/preferences", async (req, res) => {
    try {
      const { userId, companyId } = getContext(req);
      const prefsSvc = new UserPreferencesService(db, config);
      const prefs = await prefsSvc.getPreferences(userId, companyId);
      res.json(prefs);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.put("/preferences", async (req, res) => {
    try {
      const { userId, companyId } = getContext(req);
      const prefsSvc = new UserPreferencesService(db, config);
      const prefs = await prefsSvc.upsertPreferences(userId, companyId, req.body);
      res.json(prefs);
    } catch (err: any) {
      if (err instanceof ValidationError) {
        res.status(422).json({ error: err.message });
      } else {
        res.status(err.status ?? 500).json({ error: err.message });
      }
    }
  });

  // === Dictionary Translations ===
  router.get("/dictionaries", async (req, res) => {
    try {
      getContext(req); // Ensure authenticated (Req 12.1)
      const locale = (req.query.locale as string) || "en";
      const all = await _dictionaryCache.getAllDictionaries(locale);
      res.json(all);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.get("/dictionaries/:category", async (req, res) => {
    try {
      getContext(req); // Ensure authenticated (Req 12.1)
      const locale = (req.query.locale as string) || "en";
      const labels = await _dictionaryCache.getDictionaryLabels(req.params.category, locale);
      res.json(labels);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.put("/dictionaries/:category/:key", async (req, res) => {
    try {
      getContext(req); // Ensure authenticated (Board user)
      const { category, key } = req.params;
      const { label, locale } = req.body;
      if (!label || !locale) {
        res.status(400).json({ error: "label and locale are required" });
        return;
      }
      // Update in DB
      await db
        .insert(modGlobalCollabDictionaryTranslations)
        .values({ category, key, locale, label })
        .onConflictDoUpdate({
          target: [
            modGlobalCollabDictionaryTranslations.category,
            modGlobalCollabDictionaryTranslations.key,
            modGlobalCollabDictionaryTranslations.locale,
          ],
          set: { label, updatedAt: new Date() },
        });
      // Invalidate cache for this locale
      _dictionaryCache.invalidate(locale);
      res.json({ category, key, locale, label });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });
  // === Translate — Entity ===
  router.post("/translate/entity", async (req, res) => {
    try {
      const { companyId } = getContext(req);
      const { entityType, entityId, fieldName, sourceText, targetLocale } = req.body;
      if (!entityType || !entityId || !fieldName || !sourceText || !targetLocale) {
        res.status(400).json({ error: "entityType, entityId, fieldName, sourceText, and targetLocale are required" });
        return;
      }
      const svc = new TranslationService(db, config);
      const result = await svc.translateEntityField({
        companyId,
        entityType,
        entityId,
        fieldName,
        sourceText,
        targetLocale,
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post("/translate/entity/batch", async (req, res) => {
    try {
      const { companyId } = getContext(req);
      const { translations } = req.body;
      if (!Array.isArray(translations) || translations.length === 0) {
        res.status(400).json({ error: "translations array is required and must not be empty" });
        return;
      }
      const svc = new TranslationService(db, config);
      // Override companyId from context for security
      const reqs = translations.map((t: any) => ({ ...t, companyId }));
      const results = await svc.translateEntityBatch(reqs);
      res.json(results);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.get("/translate/entity/:entityType/:entityId", async (req, res) => {
    try {
      const { companyId } = getContext(req);
      const { entityType, entityId } = req.params;
      const locale = req.query.locale as string;
      if (!locale) {
        res.status(400).json({ error: "locale query parameter is required" });
        return;
      }
      const rows = await db
        .select()
        .from(modGlobalCollabEntityTranslations)
        .where(
          and(
            eq(modGlobalCollabEntityTranslations.companyId, companyId),
            eq(modGlobalCollabEntityTranslations.entityType, entityType),
            eq(modGlobalCollabEntityTranslations.entityId, entityId),
            eq(modGlobalCollabEntityTranslations.locale, locale),
          ),
        );
      // Return as a map of fieldName → translation info
      const result: Record<string, { translatedText: string; sourceLocale: string; sourceHash: string }> = {};
      for (const row of rows) {
        result[row.fieldName] = {
          translatedText: row.translatedText,
          sourceLocale: row.sourceLocale,
          sourceHash: row.sourceHash,
        };
      }
      res.json(result);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  // === Translate — Free Text ===
  router.post("/translate/text", async (req, res) => {
    try {
      const { companyId } = getContext(req);
      const { text, targetLocale } = req.body;
      if (!text || !targetLocale) {
        res.status(400).json({ error: "text and targetLocale are required" });
        return;
      }
      const svc = new TranslationService(db, config);
      const result = await svc.translateWithCache(companyId, text, targetLocale);
      res.json(result);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });
  // === Notifications ===
  const notificationSvc = new NotificationService(db);

  router.get("/notifications", async (req, res) => {
    try {
      const { userId, companyId } = getContext(req);
      const unreadOnly = req.query.unreadOnly === "true";
      const list = await notificationSvc.listForUser(userId, companyId, { unreadOnly });
      res.json(list);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.get("/notifications/unread-count", async (req, res) => {
    try {
      const { userId, companyId } = getContext(req);
      const count = await notificationSvc.getUnreadCount(userId, companyId);
      res.json({ count });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.put("/notifications/read-all", async (req, res) => {
    try {
      const { userId, companyId } = getContext(req);
      await notificationSvc.markAllAsRead(userId, companyId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.put("/notifications/:id/read", async (req, res) => {
    try {
      const { userId } = getContext(req);
      await notificationSvc.markAsRead(req.params.id, userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });
  // === Presence ===
  router.post("/presence/heartbeat", async (req, res) => {
    try {
      const { userId, companyId } = getContext(req);
      _presenceManager.heartbeat(userId, companyId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.get("/presence", async (req, res) => {
    try {
      const { companyId } = getContext(req);
      const list = _presenceManager.getPresence(companyId);
      res.json(list.map(p => ({
        userId: p.userId,
        status: p.status,
        lastSeenAt: p.lastSeenAt,
      })));
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  return router;
}
