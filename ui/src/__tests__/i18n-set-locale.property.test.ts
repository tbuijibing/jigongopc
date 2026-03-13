import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

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

describe("setLocale properties", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMockStorage(),
      writable: true,
      configurable: true,
    });
  });

  // Property 2: For any SupportedLocale, after setLocale(locale), i18n.language === locale
  it("after setLocale(locale), i18n.language equals locale", async () => {
    const { i18n } = await import("../i18n/index");

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...supportedLocales),
        async (locale: SupportedLocale) => {
          await i18n.changeLanguage(locale);
          expect(i18n.language).toBe(locale);
        }
      ),
      { numRuns: 30 }
    );
  });
});
