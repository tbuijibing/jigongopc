import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { sha256, TranslationService } from "../services/translation.js";

// ─── Mock translation-engine module ─────────────────────────────────────────

const mockTranslate = vi.fn<(text: string, src: string, tgt: string) => Promise<string>>();

vi.mock("../services/translation-engine.js", () => ({
  createTranslationEngine: () => ({ translate: mockTranslate }),
  detectLanguage: async (text: string) => {
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
    if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko";
    if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
    return "en";
  },
}));

// ─── Generators ─────────────────────────────────────────────────────────────

const ENTITY_TYPES = ["issue", "issue_comment", "agent", "company", "goal", "project"] as const;
const FIELD_NAMES = ["title", "description", "body", "name", "capabilities"] as const;
const TARGET_LOCALES = ["zh-CN", "ja", "ko", "es", "fr", "de", "pt-BR"] as const;

const entityTypeArb = fc.constantFrom(...ENTITY_TYPES);
const fieldNameArb = fc.constantFrom(...FIELD_NAMES);
const targetLocaleArb = fc.constantFrom(...TARGET_LOCALES);
// Non-empty ASCII strings to ensure detectLanguage returns "en" (no CJK/Korean/Japanese chars)
const sourceTextArb = fc.string({ minLength: 1, maxLength: 80 }).filter(
  (s) => !/[\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u1100-\u11ff\u4e00-\u9fff]/.test(s),
);

// ─── Mock DB builder ────────────────────────────────────────────────────────

/**
 * In-memory mock DB that tracks entity_translations and translation_cache rows.
 * Supports the drizzle-orm chaining patterns used by TranslationService.
 */
function createMockDb() {
  // entity_translations keyed by (companyId, entityType, entityId, fieldName, locale)
  const entityStore = new Map<string, any>();
  // translation_cache keyed by (companyId, contentHash)
  const cacheStore = new Map<string, any>();

  function entityKey(companyId: string, entityType: string, entityId: string, fieldName: string, locale: string) {
    return `${companyId}|${entityType}|${entityId}|${fieldName}|${locale}`;
  }

  function cacheKey(companyId: string, contentHash: string) {
    return `${companyId}|${contentHash}`;
  }

  // Track which table the current select/insert targets
  let currentTable: "entity" | "cache" | null = null;
  let selectFilter: Record<string, string> = {};

  const db: any = {
    select: () => ({
      from: (table: any) => {
        // Identify table by checking for known column names
        const cols = table ? Object.keys(table) : [];
        currentTable = cols.includes("sourceHash") ? "entity" : "cache";
        return {
          where: (_cond: any) => ({
            then: (resolve: (rows: any[]) => any) => {
              // The TranslationService uses .then() to extract rows
              // We return matching rows from our in-memory store
              // Since we can't parse drizzle conditions, we use a lookup approach:
              // The service always queries by the unique key, so we store a "lastLookup" hint
              const store = currentTable === "entity" ? entityStore : cacheStore;
              if (db._nextSelectResult !== undefined) {
                const result = db._nextSelectResult;
                db._nextSelectResult = undefined;
                return resolve(result);
              }
              return resolve([]);
            },
          }),
        };
      },
    }),
    insert: (table: any) => {
      const cols = table ? Object.keys(table) : [];
      currentTable = cols.includes("sourceHash") ? "entity" : "cache";
      return {
        values: (v: any) => ({
          onConflictDoUpdate: (_opts: any) => {
            if (currentTable === "entity") {
              const k = entityKey(v.companyId, v.entityType, v.entityId, v.fieldName, v.locale);
              entityStore.set(k, { ...v });
            }
            return Promise.resolve();
          },
          onConflictDoNothing: () => {
            if (currentTable === "cache") {
              const k = cacheKey(v.companyId, v.contentHash);
              if (!cacheStore.has(k)) {
                cacheStore.set(k, { ...v });
              }
            }
            return Promise.resolve();
          },
        }),
      };
    },
    // Helpers for tests
    _entityStore: entityStore,
    _cacheStore: cacheStore,
    _entityKey: entityKey,
    _cacheKey: cacheKey,
    _nextSelectResult: undefined as any[] | undefined,
  };

  return db;
}


// ─── Property 6: 业务内容翻译 sourceHash 一致性 ────────────────────────────
// **Validates: Requirements 5.2, 5.3, 5.4**

describe("Property 6: Entity translation sourceHash consistency", () => {
  let db: ReturnType<typeof createMockDb>;
  let svc: TranslationService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    svc = new TranslationService(db, {});
    mockTranslate.mockImplementation(async (text) => `translated:${text}`);
  });

  it("sha256(sourceText) is deterministic — same input always produces same hash", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (text) => {
          const h1 = sha256(text);
          const h2 = sha256(text);
          expect(h1).toBe(h2);
          expect(h1).toMatch(/^[0-9a-f]{64}$/);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("cache hit with matching sourceHash returns cached=true without calling engine", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        entityTypeArb,
        fieldNameArb,
        sourceTextArb,
        targetLocaleArb,
        async (companyId, entityId, entityType, fieldName, sourceText, targetLocale) => {
          vi.clearAllMocks();
          db = createMockDb();
          svc = new TranslationService(db, {});
          mockTranslate.mockImplementation(async (t) => `translated:${t}`);

          const hash = sha256(sourceText);
          // Pre-populate cache with matching sourceHash
          db._nextSelectResult = [{
            translatedText: `cached:${sourceText}`,
            sourceLocale: "en",
            sourceHash: hash,
          }];

          const result = await svc.translateEntityField({
            companyId, entityType, entityId, fieldName, sourceText, targetLocale,
          });

          expect(result.cached).toBe(true);
          expect(result.stale).toBe(false);
          expect(result.translatedText).toBe(`cached:${sourceText}`);
          expect(mockTranslate).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });

  it("different source text produces different sourceHash and triggers re-translation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        entityTypeArb,
        fieldNameArb,
        sourceTextArb,
        sourceTextArb.filter((s) => s.length > 0),
        targetLocaleArb,
        async (companyId, entityId, entityType, fieldName, text1, text2, targetLocale) => {
          // Only test when texts are actually different
          fc.pre(text1 !== text2);

          vi.clearAllMocks();
          db = createMockDb();
          svc = new TranslationService(db, {});
          mockTranslate.mockImplementation(async (t) => `translated:${t}`);

          const hash1 = sha256(text1);
          const hash2 = sha256(text2);
          expect(hash1).not.toBe(hash2);

          // Cache has translation for text1
          db._nextSelectResult = [{
            translatedText: `cached:${text1}`,
            sourceLocale: "en",
            sourceHash: hash1,
          }];

          // Request translation for text2 (different source text)
          const result = await svc.translateEntityField({
            companyId, entityType, entityId, fieldName, sourceText: text2, targetLocale,
          });

          // Should re-translate since sourceHash doesn't match
          expect(result.cached).toBe(false);
          expect(mockTranslate).toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });
});


// ─── Property 7: entity_translations 唯一性 ────────────────────────────────
// **Validates: Requirement 5.5**

describe("Property 7: entity_translations uniqueness", () => {
  let db: ReturnType<typeof createMockDb>;
  let svc: TranslationService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    svc = new TranslationService(db, {});
    mockTranslate.mockImplementation(async (text) => `translated:${text}`);
  });

  it("translating the same entity field to the same locale multiple times results in at most one record (UPSERT)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        entityTypeArb,
        fieldNameArb,
        targetLocaleArb,
        fc.array(sourceTextArb, { minLength: 2, maxLength: 5 }),
        async (companyId, entityId, entityType, fieldName, targetLocale, sourceTexts) => {
          vi.clearAllMocks();
          db = createMockDb();
          svc = new TranslationService(db, {});
          mockTranslate.mockImplementation(async (t) => `translated:${t}`);

          // Translate the same entity field multiple times with different source texts
          for (const sourceText of sourceTexts) {
            // Each call starts with empty cache (simulating fresh lookup)
            db._nextSelectResult = [];
            await svc.translateEntityField({
              companyId, entityType, entityId, fieldName, sourceText, targetLocale,
            });
          }

          // Check the in-memory entity store: should have exactly one entry for this key
          const key = db._entityKey(companyId, entityType, entityId, fieldName, targetLocale);
          const entries = [...db._entityStore.entries()].filter(([k]) => k === key);
          expect(entries.length).toBe(1);

          // The stored entry should have the last source text's hash (last-write-wins via UPSERT)
          const lastText = sourceTexts[sourceTexts.length - 1];
          const stored = db._entityStore.get(key);
          expect(stored.sourceHash).toBe(sha256(lastText));
        },
      ),
      { numRuns: 50 },
    );
  });

  it("different (companyId, entityType, entityId, fieldName, locale) combinations create separate records", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        entityTypeArb,
        fieldNameArb,
        sourceTextArb,
        targetLocaleArb,
        async (companyId1, companyId2, entityId1, entityId2, entityType, fieldName, sourceText, targetLocale) => {
          fc.pre(companyId1 !== companyId2 || entityId1 !== entityId2);

          vi.clearAllMocks();
          db = createMockDb();
          svc = new TranslationService(db, {});
          mockTranslate.mockImplementation(async (t) => `translated:${t}`);

          db._nextSelectResult = [];
          await svc.translateEntityField({
            companyId: companyId1, entityType, entityId: entityId1, fieldName, sourceText, targetLocale,
          });

          db._nextSelectResult = [];
          await svc.translateEntityField({
            companyId: companyId2, entityType, entityId: entityId2, fieldName, sourceText, targetLocale,
          });

          const key1 = db._entityKey(companyId1, entityType, entityId1, fieldName, targetLocale);
          const key2 = db._entityKey(companyId2, entityType, entityId2, fieldName, targetLocale);

          expect(db._entityStore.has(key1)).toBe(true);
          expect(db._entityStore.has(key2)).toBe(true);
          // They should be separate entries (different keys)
          if (key1 !== key2) {
            expect(db._entityStore.size).toBeGreaterThanOrEqual(2);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});


// ─── Property 8: 通用翻译缓存往返一致性 ────────────────────────────────────
// **Validates: Requirements 6.2, 6.3, 6.4**

describe("Property 8: Translation cache round-trip consistency", () => {
  let db: ReturnType<typeof createMockDb>;
  let svc: TranslationService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    svc = new TranslationService(db, {});
    mockTranslate.mockImplementation(async (text) => `translated:${text}`);
  });

  it("contentHash = SHA-256(sourceText + '::' + targetLocale) is deterministic", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        targetLocaleArb,
        (text, locale) => {
          const h1 = sha256(`${text}::${locale}`);
          const h2 = sha256(`${text}::${locale}`);
          expect(h1).toBe(h2);
          expect(h1).toMatch(/^[0-9a-f]{64}$/);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("translating the same text to the same locale twice returns cached=true on second call", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        sourceTextArb,
        targetLocaleArb,
        async (companyId, text, targetLocale) => {
          vi.clearAllMocks();
          db = createMockDb();
          svc = new TranslationService(db, {});
          mockTranslate.mockImplementation(async (t) => `translated:${t}`);

          // First call — cache miss
          db._nextSelectResult = [];
          const first = await svc.translateWithCache(companyId, text, targetLocale);
          expect(first.cached).toBe(false);
          expect(mockTranslate).toHaveBeenCalledTimes(1);

          // Second call — simulate cache hit by returning the stored entry
          const contentHash = sha256(`${text}::${targetLocale}`);
          const storedEntry = db._cacheStore.get(db._cacheKey(companyId, contentHash));
          db._nextSelectResult = storedEntry ? [storedEntry] : [];

          vi.clearAllMocks();
          const second = await svc.translateWithCache(companyId, text, targetLocale);
          expect(second.cached).toBe(true);
          expect(second.translatedText).toBe(first.translatedText);
          expect(mockTranslate).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });

  it("different text or different locale produces different contentHash values", () => {
    fc.assert(
      fc.property(
        sourceTextArb,
        sourceTextArb,
        targetLocaleArb,
        targetLocaleArb,
        (text1, text2, locale1, locale2) => {
          // Only test when at least one of text or locale differs
          fc.pre(text1 !== text2 || locale1 !== locale2);

          const hash1 = sha256(`${text1}::${locale1}`);
          const hash2 = sha256(`${text2}::${locale2}`);

          if (text1 !== text2 || locale1 !== locale2) {
            expect(hash1).not.toBe(hash2);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("cache entries are keyed by (companyId, contentHash) — different companies get separate caches", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        sourceTextArb,
        targetLocaleArb,
        async (companyId1, companyId2, text, targetLocale) => {
          fc.pre(companyId1 !== companyId2);

          vi.clearAllMocks();
          db = createMockDb();
          svc = new TranslationService(db, {});
          mockTranslate.mockImplementation(async (t) => `translated:${t}`);

          // Translate same text for two different companies
          db._nextSelectResult = [];
          await svc.translateWithCache(companyId1, text, targetLocale);

          db._nextSelectResult = [];
          await svc.translateWithCache(companyId2, text, targetLocale);

          const contentHash = sha256(`${text}::${targetLocale}`);
          const key1 = db._cacheKey(companyId1, contentHash);
          const key2 = db._cacheKey(companyId2, contentHash);

          expect(db._cacheStore.has(key1)).toBe(true);
          expect(db._cacheStore.has(key2)).toBe(true);
          expect(key1).not.toBe(key2);
        },
      ),
      { numRuns: 30 },
    );
  });
});
