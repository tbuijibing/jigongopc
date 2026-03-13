import type { ModuleAPI } from "./types.js";
import { createRouter } from "./routes.js";
import {
  onIssueCreated,
  onIssueAssigned,
  onIssueStatusChanged,
  onCommentCreated,
  onAgentHeartbeat,
} from "./hooks.js";
import { PresenceManager } from "./services/presence.js";
import { DictionaryTranslationCache } from "./services/dictionary-cache.js";
import { seedDictionaryTranslations } from "./seed/dictionary-translations.js";
import { lt } from "drizzle-orm";
import { modGlobalCollabTranslationCache } from "./schema.js";

export default function register(api: ModuleAPI) {
  // ── Module disable check (Req 1.3, 1.4) ──────────────────────────────
  // If the module is explicitly disabled via config, skip all registration.
  // Data in mod_global_collab_* tables is preserved — re-enabling restores
  // full functionality without data loss.
  if (api.config.enabled === false) {
    api.logger.info(
      "Global Collaboration module is disabled — skipping registration. " +
      "Module data is preserved; set enabled=true to restore.",
    );
    return;
  }

  // Initialise module services
  const presenceManager = new PresenceManager(api.config);
  const dictionaryCache = new DictionaryTranslationCache(api.db);

  // Register routes (mounted under /api/modules/global-collab/)
  api.registerRoutes(
    createRouter(api.db, api.config, api.core, presenceManager, dictionaryCache),
  );

  // Subscribe to core hooks
  api.on("issue:created", onIssueCreated(api.db, api.core));
  api.on("issue:assigned", onIssueAssigned(api.db, api.core));
  api.on("issue:status_changed", onIssueStatusChanged(api.db, api.core));
  api.on(
    "issue:comment.created",
    onCommentCreated(api.db, api.core, presenceManager),
  );
  api.on("agent:heartbeat", onAgentHeartbeat(presenceManager));

  // Background service: clean up expired translation cache entries every hour
  const cacheTtlMs =
    typeof api.config.translationCacheTtlMs === "number"
      ? api.config.translationCacheTtlMs
      : 24 * 60 * 60 * 1000; // default 24 hours

  api.registerService({
    name: "translation-cache-cleanup",
    interval: 3_600_000,
    async run(_ctx) {
      const cutoff = new Date(Date.now() - cacheTtlMs);
      await api.db
        .delete(modGlobalCollabTranslationCache)
        .where(lt(modGlobalCollabTranslationCache.createdAt, cutoff));
    },
  });

  // Background service: invalidate dictionary memory cache every 5 minutes
  api.registerService({
    name: "dictionary-cache-refresh",
    interval: 300_000,
    async run() {
      dictionaryCache.invalidate();
    },
  });

  // Seed dictionary translations (idempotent — safe on every load)
  seedDictionaryTranslations(api.db)
    .then((count) => {
      if (count > 0) api.logger.info(`Seeded ${count} dictionary translations`);
    })
    .catch((err) => {
      api.logger.warn(`Dictionary seed failed (tables may not exist yet): ${err.message}`);
    });

  api.logger.info("Global Collaboration module registered");
}

