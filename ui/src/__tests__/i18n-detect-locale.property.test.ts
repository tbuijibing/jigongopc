import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";

const LOCALE_STORAGE_KEY = "Jigong.locale";
const supportedLocales = ["en", "zh-CN", "ja"] as const;
type SupportedLocale = (typeof supportedLocales)[number];

function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

describe("detectLocale properties", () => {
  const originalNavigator = globalThis.navigator;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  // Property 1: detectLocale always returns a SupportedLocale member
  it("always returns a valid SupportedLocale for arbitrary localStorage and navigator.language values", async () => {
    const { detectLocale } = await import("../i18n/index");

    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: undefined }),
        fc.string(),
        (storedValue, browserLang) => {
          mockStorage.clear();
          if (storedValue !== undefined) {
            mockStorage.setItem(LOCALE_STORAGE_KEY, storedValue);
          }
          Object.defineProperty(globalThis, "navigator", {
            value: { language: browserLang },
            writable: true,
            configurable: true,
          });

          const result = detectLocale();
          expect(supportedLocales).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 3: Persistence consistency — after setting locale in localStorage, detectLocale returns it
  it("returns the stored locale after it was persisted to localStorage", async () => {
    const { detectLocale } = await import("../i18n/index");

    fc.assert(
      fc.property(
        fc.constantFrom(...supportedLocales),
        (locale: SupportedLocale) => {
          mockStorage.setItem(LOCALE_STORAGE_KEY, locale);
          const result = detectLocale();
          expect(result).toBe(locale);
        }
      ),
      { numRuns: 50 }
    );
  });
});
