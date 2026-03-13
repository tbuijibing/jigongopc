import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import en from "../i18n/locales/en.json";
import zhCN from "../i18n/locales/zh-CN.json";
import ja from "../i18n/locales/ja.json";

/**
 * Property 4: For every key in en.json, zh-CN.json and ja.json contain the same key
 * Validates: Requirements 4.1, 4.2, 4.3
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

const enKeys = flattenKeys(en);
const zhCNKeys = new Set(flattenKeys(zhCN));
const jaKeys = new Set(flattenKeys(ja));

describe("Translation key completeness (Property 4)", () => {
  it("zh-CN.json contains every key from en.json", () => {
    fc.assert(
      fc.property(fc.constantFrom(...enKeys), (key: string) => {
        expect(zhCNKeys.has(key), `zh-CN.json missing key: ${key}`).toBe(true);
      }),
      { numRuns: enKeys.length }
    );
  });

  it("ja.json contains every key from en.json", () => {
    fc.assert(
      fc.property(fc.constantFrom(...enKeys), (key: string) => {
        expect(jaKeys.has(key), `ja.json missing key: ${key}`).toBe(true);
      }),
      { numRuns: enKeys.length }
    );
  });
});
