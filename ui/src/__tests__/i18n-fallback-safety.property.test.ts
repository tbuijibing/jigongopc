import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import en from "../i18n/locales/en.json";
import { i18n, supportedLocales } from "../i18n/index";

/**
 * Property 5: For any translation key and any SupportedLocale, t(key) returns a non-empty string
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 9.1
 */

/** Recursively extract all flat dot-separated keys from a nested JSON object */
function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const allKeys = flattenKeys(en);

describe("Fallback safety (Property 5)", () => {
  it("t(key, { lng: locale }) returns a non-empty string for every key and locale", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allKeys),
        fc.constantFrom(...supportedLocales),
        (key: string, locale: string) => {
          const result = i18n.t(key, { lng: locale });
          expect(result).toBeTruthy();
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: allKeys.length * supportedLocales.length }
    );
  });
});
