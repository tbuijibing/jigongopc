import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { DictionaryTranslationCache } from "../services/dictionary-cache.js";

// ─── Property 5: 数据字典翻译 fallback ─────────────────────────────────────
// **Validates: Requirements 4.4, 4.6**

describe("Property 5: Dictionary translation fallback", () => {
  it("returns original key for any missing (category, key, locale) combination", async () => {
    // Empty DB mock — select always returns no rows
    const db = {
      select: () => ({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
    };
    const cache = new DictionaryTranslationCache(db);

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.constantFrom("en", "zh-CN", "ja", "ko"),
        async (category, key, locale) => {
          cache.invalidate(); // Reset cache for each run
          const label = await cache.getDictionaryLabel(category, key, locale);
          expect(label).toBe(key); // Fallback to key
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns updated value after modification", async () => {
    // DB mock that returns specific translations
    const translations = [
      { category: "issue_status", key: "backlog", locale: "zh-CN", label: "待办" },
    ];
    const db = {
      select: () => ({
        from: () => ({ where: () => Promise.resolve(translations) }),
      }),
    };
    const cache = new DictionaryTranslationCache(db);

    await fc.assert(
      fc.asyncProperty(
        fc.constant("issue_status"),
        fc.constant("backlog"),
        fc.constant("zh-CN"),
        async (category, key, locale) => {
          cache.invalidate();
          const label = await cache.getDictionaryLabel(category, key, locale);
          expect(label).toBe("待办");
        },
      ),
      { numRuns: 10 },
    );
  });
});
