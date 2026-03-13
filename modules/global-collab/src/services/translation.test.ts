import { describe, it, expect, vi, beforeEach } from "vitest";
import { sha256, TranslationService } from "./translation.js";
import type {
  EntityTranslationRequest,
  EntityTranslationResult,
  TextTranslationResult,
} from "./translation.js";

// ─── Mock translation-engine module ─────────────────────────────────────────

const mockTranslate = vi.fn<(text: string, src: string, tgt: string) => Promise<string>>();

vi.mock("./translation-engine.js", () => ({
  createTranslationEngine: () => ({ translate: mockTranslate }),
  detectLanguage: async (text: string) => {
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
    if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko";
    if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
    return "en";
  },
}));

// ─── Mock DB builder ────────────────────────────────────────────────────────

/**
 * Creates a mock DB that simulates drizzle-orm select/insert chains.
 * `store` holds rows keyed by table reference for lookup.
 */
function createMockDb() {
  const entityRows: any[] = [];
  const cacheRows: any[] = [];
  let lastInsertTable: string | null = null;

  const db = {
    select: () => ({
      from: (table: any) => ({
        where: (_cond: any) => ({
          then: (resolve: (rows: any[]) => any) => {
            // Determine which store to query based on table name
            const tableName = table?.[Symbol.for("drizzle:Name")] ?? table?._.name ?? "";
            if (tableName.includes("entity_translation") || table === entityTransRef) {
              return resolve(entityRows);
            }
            return resolve(cacheRows);
          },
        }),
      }),
    }),
    insert: (table: any) => {
      const tableName = table?.[Symbol.for("drizzle:Name")] ?? table?._.name ?? "";
      lastInsertTable = tableName;
      return {
        values: (v: any) => ({
          onConflictDoUpdate: (_opts: any) => Promise.resolve(),
          onConflictDoNothing: () => Promise.resolve(),
        }),
      };
    },
    // Expose stores for test manipulation
    _entityRows: entityRows,
    _cacheRows: cacheRows,
  };

  return db;
}

// Keep a reference to the imported schema tables for comparison
let entityTransRef: any;
let cacheRef: any;

// ─── sha256 ─────────────────────────────────────────────────────────────────

describe("sha256", () => {
  it("produces consistent hashes for the same input", () => {
    const h1 = sha256("hello world");
    const h2 = sha256("hello world");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different inputs", () => {
    const h1 = sha256("hello");
    const h2 = sha256("world");
    expect(h1).not.toBe(h2);
  });

  it("returns a 64-character hex string", () => {
    const h = sha256("test");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── TranslationService — Entity Translation (5.2) ─────────────────────────

describe("TranslationService — translateEntityField", () => {
  let svc: TranslationService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    svc = new TranslationService(db, {});
    mockTranslate.mockResolvedValue("translated-text");
  });

  const baseReq: EntityTranslationRequest = {
    companyId: "comp-1",
    entityType: "issue",
    entityId: "issue-1",
    fieldName: "title",
    sourceText: "Hello world",
    targetLocale: "zh-CN",
  };

  it("returns cached result when sourceHash matches", async () => {
    const sourceHash = sha256("Hello world");
    db._entityRows.push({
      translatedText: "你好世界",
      sourceLocale: "en",
      sourceHash,
    });

    const result = await svc.translateEntityField(baseReq);

    expect(result.translatedText).toBe("你好世界");
    expect(result.sourceLocale).toBe("en");
    expect(result.targetLocale).toBe("zh-CN");
    expect(result.stale).toBe(false);
    expect(result.cached).toBe(true);
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it("re-translates when sourceHash differs (stale detection)", async () => {
    db._entityRows.push({
      translatedText: "旧翻译",
      sourceLocale: "en",
      sourceHash: sha256("Old text"),
    });

    const result = await svc.translateEntityField(baseReq);

    expect(result.cached).toBe(false);
    expect(result.stale).toBe(false);
    expect(result.translatedText).toBe("translated-text");
    expect(mockTranslate).toHaveBeenCalledOnce();
  });

  it("skips translation when source === target locale", async () => {
    const req: EntityTranslationRequest = {
      ...baseReq,
      sourceText: "Hello world",
      targetLocale: "en", // English text → English target
    };

    const result = await svc.translateEntityField(req);

    expect(result.translatedText).toBe("Hello world");
    expect(result.sourceLocale).toBe("en");
    expect(result.targetLocale).toBe("en");
    expect(result.stale).toBe(false);
    expect(result.cached).toBe(false);
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it("calls engine and returns fresh translation on cache miss", async () => {
    // db._entityRows is empty → cache miss
    const result = await svc.translateEntityField(baseReq);

    expect(result.translatedText).toBe("translated-text");
    expect(result.sourceLocale).toBe("en");
    expect(result.cached).toBe(false);
    expect(result.stale).toBe(false);
    expect(mockTranslate).toHaveBeenCalledWith("Hello world", "en", "zh-CN");
  });

  it("translateEntityBatch processes multiple requests", async () => {
    const reqs: EntityTranslationRequest[] = [
      { ...baseReq, entityId: "issue-1" },
      { ...baseReq, entityId: "issue-2" },
    ];

    const results = await svc.translateEntityBatch(reqs);

    expect(results).toHaveLength(2);
    expect(mockTranslate).toHaveBeenCalledTimes(2);
  });
});

// ─── TranslationService — Free-Text Translation (5.3) ──────────────────────

describe("TranslationService — translateWithCache", () => {
  let svc: TranslationService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    svc = new TranslationService(db, {});
    mockTranslate.mockResolvedValue("cached-translation");
  });

  it("returns cached result on contentHash match", async () => {
    const contentHash = sha256("Hello::zh-CN");
    db._cacheRows.push({
      translatedText: "你好",
      sourceLocale: "en",
      targetLocale: "zh-CN",
      contentHash,
    });

    const result = await svc.translateWithCache("comp-1", "Hello", "zh-CN");

    expect(result.translatedText).toBe("你好");
    expect(result.sourceLocale).toBe("en");
    expect(result.targetLocale).toBe("zh-CN");
    expect(result.cached).toBe(true);
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it("skips translation when source === target locale", async () => {
    const result = await svc.translateWithCache(
      "comp-1",
      "Hello world",
      "en",
    );

    expect(result.translatedText).toBe("Hello world");
    expect(result.sourceLocale).toBe("en");
    expect(result.targetLocale).toBe("en");
    expect(result.cached).toBe(false);
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it("calls engine and returns fresh translation on cache miss", async () => {
    const result = await svc.translateWithCache(
      "comp-1",
      "Hello world",
      "zh-CN",
    );

    expect(result.translatedText).toBe("cached-translation");
    expect(result.sourceLocale).toBe("en");
    expect(result.targetLocale).toBe("zh-CN");
    expect(result.cached).toBe(false);
    expect(mockTranslate).toHaveBeenCalledWith("Hello world", "en", "zh-CN");
  });

  it("uses correct contentHash formula: sha256(text + '::' + targetLocale)", async () => {
    // Verify the hash formula matches the spec
    const text = "Test text";
    const locale = "ja";
    const expectedHash = sha256(`${text}::${locale}`);

    // Put a cache entry with the expected hash
    db._cacheRows.push({
      translatedText: "テスト",
      sourceLocale: "en",
      targetLocale: "ja",
      contentHash: expectedHash,
    });

    const result = await svc.translateWithCache("comp-1", text, locale);

    // Should hit cache because hash matches
    expect(result.cached).toBe(true);
    expect(result.translatedText).toBe("テスト");
  });
});
