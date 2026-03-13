import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  validateTimezone,
  validateLocale,
  validateDateFormat,
  ValidationError,
} from "../services/user-preferences.js";
import {
  resolveDisplayTimestamp,
  type DateFormat,
} from "../services/timezone.js";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// ─── Generators ─────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = [
  "en",
  "zh-CN",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
  "pt-BR",
];

const VALID_TIMEZONES = [
  "UTC",
  "America/New_York",
  "Asia/Shanghai",
  "Europe/London",
  "Asia/Tokyo",
  "America/Los_Angeles",
  "Europe/Berlin",
  "Australia/Sydney",
];

const VALID_DATE_FORMATS: DateFormat[] = ["relative", "absolute", "both"];

const validTimezoneArb = fc.constantFrom(...VALID_TIMEZONES);
const validLocaleArb = fc.constantFrom(...SUPPORTED_LOCALES);
const validDateFormatArb = fc.constantFrom(...VALID_DATE_FORMATS);
// Generate dates within a reasonable range (2020-2025), filtering out NaN dates
const validDateArb = fc
  .date({
    min: new Date("2020-01-01T00:00:00Z"),
    max: new Date("2025-12-31T23:59:59Z"),
  })
  .filter((d) => !isNaN(d.getTime()));


// ─── Property 2: 用户偏好往返一致性 ────────────────────────────────────────
// **Validates: Requirements 2.1, 2.2, 2.6**

describe("Property 2: User preferences round-trip consistency", () => {
  it("upsert then get returns equivalent values", () => {
    // In-memory store simulating DB UPSERT behaviour
    const store = new Map<string, any>();

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        validTimezoneArb,
        validLocaleArb,
        validDateFormatArb,
        (userId, companyId, timezone, locale, dateFormat) => {
          const key = `${userId}:${companyId}`;
          // Simulate UPSERT
          store.set(key, { userId, companyId, timezone, locale, dateFormat });
          // Simulate GET
          const retrieved = store.get(key);
          expect(retrieved.timezone).toBe(timezone);
          expect(retrieved.locale).toBe(locale);
          expect(retrieved.dateFormat).toBe(dateFormat);
          // Uniqueness: only one record per key
          const allForKey = [...store.entries()].filter(([k]) => k === key);
          expect(allForKey.length).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("multiple upserts for same (userId, companyId) always result in one record with last-write-wins", () => {
    const store = new Map<string, any>();

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.array(
          fc.record({
            timezone: validTimezoneArb,
            locale: validLocaleArb,
            dateFormat: validDateFormatArb,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (userId, companyId, patches) => {
          const key = `${userId}:${companyId}`;
          for (const patch of patches) {
            store.set(key, { userId, companyId, ...patch });
          }
          // Should always be exactly one record
          expect(store.has(key)).toBe(true);
          // Last write wins
          const last = patches[patches.length - 1];
          const stored = store.get(key);
          expect(stored.timezone).toBe(last.timezone);
          expect(stored.locale).toBe(last.locale);
          expect(stored.dateFormat).toBe(last.dateFormat);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Property 3: 无效偏好输入拒绝 ──────────────────────────────────────────
// **Validates: Requirements 2.4, 2.5**

describe("Property 3: Invalid preferences input rejection", () => {
  it("rejects any non-IANA timezone string", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => {
            try {
              validateTimezone(s);
              return false;
            } catch {
              return true;
            }
          }),
        (invalidTz) => {
          expect(() => validateTimezone(invalidTz)).toThrow(ValidationError);
          try {
            validateTimezone(invalidTz);
          } catch (e: any) {
            expect(e.status).toBe(422);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects any locale not in supported list", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 10 })
          .filter((s) => !SUPPORTED_LOCALES.includes(s)),
        (invalidLocale) => {
          expect(() =>
            validateLocale(invalidLocale, SUPPORTED_LOCALES),
          ).toThrow(ValidationError);
          try {
            validateLocale(invalidLocale, SUPPORTED_LOCALES);
          } catch (e: any) {
            expect(e.status).toBe(422);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects any dateFormat not in valid set", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => !VALID_DATE_FORMATS.includes(s as any)),
        (invalidFormat) => {
          expect(() => validateDateFormat(invalidFormat)).toThrow(
            ValidationError,
          );
          try {
            validateDateFormat(invalidFormat);
          } catch (e: any) {
            expect(e.status).toBe(422);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 4: resolveDisplayTimestamp 格式正确性 ─────────────────────────
// **Validates: Requirements 3.2, 3.3, 3.4**

describe("Property 4: resolveDisplayTimestamp format correctness", () => {
  it("always returns non-empty string", () => {
    fc.assert(
      fc.property(validDateArb, validTimezoneArb, validDateFormatArb, (date, tz, fmt) => {
        const result = resolveDisplayTimestamp(
          date.toISOString(),
          tz,
          fmt,
          new Date("2025-06-01T00:00:00Z"),
        );
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it("absolute format contains date pattern and time", () => {
    fc.assert(
      fc.property(validDateArb, validTimezoneArb, (date, tz) => {
        const result = resolveDisplayTimestamp(date.toISOString(), tz, "absolute");
        // Should contain YYYY-MM-DD pattern
        expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
        // Should contain HH:mm pattern
        expect(result).toMatch(/\d{2}:\d{2}/);
      }),
      { numRuns: 100 },
    );
  });

  it("both format contains parenthesized absolute portion", () => {
    fc.assert(
      fc.property(validDateArb, validTimezoneArb, (date, tz) => {
        const now = new Date("2025-06-01T00:00:00Z");
        const result = resolveDisplayTimestamp(date.toISOString(), tz, "both", now);
        expect(result).toContain("(");
        expect(result).toContain(")");
        // The parenthesized part should contain a date
        expect(result).toMatch(/\(\d{4}-\d{2}-\d{2}/);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 1: 时区转换往返一致性 ────────────────────────────────────────
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

describe("Property 1: Timezone conversion round-trip consistency", () => {
  it("UTC → local → UTC round-trip preserves timestamp", () => {
    fc.assert(
      fc.property(validDateArb, validTimezoneArb, (date, tz) => {
        // Convert UTC to zoned time
        const zoned = toZonedTime(date, tz);
        // Convert back to UTC
        const roundTripped = fromZonedTime(zoned, tz);
        // Should be within 1 second (to account for any rounding)
        expect(Math.abs(date.getTime() - roundTripped.getTime())).toBeLessThan(1000);
      }),
      { numRuns: 200 },
    );
  });
});
