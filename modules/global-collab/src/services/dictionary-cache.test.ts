import { describe, it, expect, vi } from "vitest";
import { DictionaryTranslationCache } from "./dictionary-cache.js";

// ─── Mock DB helper ─────────────────────────────────────────────────────────

function createMockDb(rows: Array<{ category: string; key: string; locale: string; label: string }>) {
  const selectSpy = vi.fn();

  const db = {
    select: () => {
      selectSpy();
      return {
        from: () => ({
          where: () => Promise.resolve(rows),
        }),
      };
    },
    _selectSpy: selectSpy,
  };

  return db;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("DictionaryTranslationCache", () => {
  it("getDictionaryLabel returns fallback key when no translation exists", async () => {
    const db = createMockDb([]);
    const cache = new DictionaryTranslationCache(db);

    const label = await cache.getDictionaryLabel("issue_status", "unknown_key", "en");

    expect(label).toBe("unknown_key");
  });

  it("getDictionaryLabel returns cached label after loading", async () => {
    const db = createMockDb([
      { category: "issue_status", key: "backlog", locale: "zh-CN", label: "待办" },
      { category: "issue_status", key: "todo", locale: "zh-CN", label: "待处理" },
      { category: "issue_priority", key: "high", locale: "zh-CN", label: "高" },
    ]);
    const cache = new DictionaryTranslationCache(db);

    const label = await cache.getDictionaryLabel("issue_status", "backlog", "zh-CN");
    expect(label).toBe("待办");

    const label2 = await cache.getDictionaryLabel("issue_priority", "high", "zh-CN");
    expect(label2).toBe("高");
  });

  it("getDictionaryLabel returns key as fallback for missing category", async () => {
    const db = createMockDb([
      { category: "issue_status", key: "backlog", locale: "en", label: "Backlog" },
    ]);
    const cache = new DictionaryTranslationCache(db);

    const label = await cache.getDictionaryLabel("nonexistent_category", "some_key", "en");
    expect(label).toBe("some_key");
  });

  it("getDictionaryLabel returns key as fallback for missing key in existing category", async () => {
    const db = createMockDb([
      { category: "issue_status", key: "backlog", locale: "en", label: "Backlog" },
    ]);
    const cache = new DictionaryTranslationCache(db);

    const label = await cache.getDictionaryLabel("issue_status", "missing_key", "en");
    expect(label).toBe("missing_key");
  });

  it("ensureLoaded only queries DB once per locale", async () => {
    const db = createMockDb([
      { category: "issue_status", key: "backlog", locale: "en", label: "Backlog" },
    ]);
    const cache = new DictionaryTranslationCache(db);

    // First call loads from DB
    await cache.getDictionaryLabel("issue_status", "backlog", "en");
    // Second call should use cache
    await cache.getDictionaryLabel("issue_status", "backlog", "en");
    // Third call for same locale
    await cache.getDictionaryLabels("issue_status", "en");

    expect(db._selectSpy).toHaveBeenCalledTimes(1);
  });

  it("ensureLoaded queries DB separately for different locales", async () => {
    const db = createMockDb([]);
    const cache = new DictionaryTranslationCache(db);

    await cache.getDictionaryLabel("issue_status", "backlog", "en");
    await cache.getDictionaryLabel("issue_status", "backlog", "zh-CN");

    expect(db._selectSpy).toHaveBeenCalledTimes(2);
  });

  it("invalidate(locale) clears only that locale's cache", async () => {
    const db = createMockDb([
      { category: "issue_status", key: "backlog", locale: "en", label: "Backlog" },
    ]);
    const cache = new DictionaryTranslationCache(db);

    // Load both locales
    await cache.ensureLoaded("en");
    await cache.ensureLoaded("zh-CN");
    expect(db._selectSpy).toHaveBeenCalledTimes(2);

    // Invalidate only "en"
    cache.invalidate("en");

    // "en" should re-query
    await cache.ensureLoaded("en");
    expect(db._selectSpy).toHaveBeenCalledTimes(3);

    // "zh-CN" should NOT re-query
    await cache.ensureLoaded("zh-CN");
    expect(db._selectSpy).toHaveBeenCalledTimes(3);
  });

  it("invalidate() with no args clears all cached data", async () => {
    const db = createMockDb([]);
    const cache = new DictionaryTranslationCache(db);

    await cache.ensureLoaded("en");
    await cache.ensureLoaded("zh-CN");
    expect(db._selectSpy).toHaveBeenCalledTimes(2);

    cache.invalidate();

    await cache.ensureLoaded("en");
    await cache.ensureLoaded("zh-CN");
    expect(db._selectSpy).toHaveBeenCalledTimes(4);
  });

  it("getDictionaryLabels returns all labels for a category", async () => {
    const db = createMockDb([
      { category: "issue_status", key: "backlog", locale: "en", label: "Backlog" },
      { category: "issue_status", key: "todo", locale: "en", label: "To Do" },
      { category: "issue_priority", key: "high", locale: "en", label: "High" },
    ]);
    const cache = new DictionaryTranslationCache(db);

    const labels = await cache.getDictionaryLabels("issue_status", "en");
    expect(labels).toEqual({ backlog: "Backlog", todo: "To Do" });
  });

  it("getDictionaryLabels returns empty object for missing category", async () => {
    const db = createMockDb([]);
    const cache = new DictionaryTranslationCache(db);

    const labels = await cache.getDictionaryLabels("nonexistent", "en");
    expect(labels).toEqual({});
  });

  it("getAllDictionaries returns all categories for a locale", async () => {
    const db = createMockDb([
      { category: "issue_status", key: "backlog", locale: "en", label: "Backlog" },
      { category: "issue_status", key: "todo", locale: "en", label: "To Do" },
      { category: "issue_priority", key: "high", locale: "en", label: "High" },
    ]);
    const cache = new DictionaryTranslationCache(db);

    const all = await cache.getAllDictionaries("en");
    expect(all).toEqual({
      issue_status: { backlog: "Backlog", todo: "To Do" },
      issue_priority: { high: "High" },
    });
  });

  it("getAllDictionaries returns empty object for locale with no translations", async () => {
    const db = createMockDb([]);
    const cache = new DictionaryTranslationCache(db);

    const all = await cache.getAllDictionaries("ja");
    expect(all).toEqual({});
  });
});
