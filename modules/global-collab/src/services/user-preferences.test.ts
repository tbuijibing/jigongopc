import { describe, it, expect } from "vitest";
import {
  ValidationError,
  validateTimezone,
  validateLocale,
  validateDateFormat,
  UserPreferencesService,
} from "./user-preferences.js";

// ─── Validation helpers ─────────────────────────────────────────────────────

describe("validateTimezone", () => {
  it("accepts valid IANA timezones", () => {
    expect(() => validateTimezone("UTC")).not.toThrow();
    expect(() => validateTimezone("America/New_York")).not.toThrow();
    expect(() => validateTimezone("Asia/Shanghai")).not.toThrow();
    expect(() => validateTimezone("Europe/London")).not.toThrow();
  });

  it("rejects invalid timezones with 422 ValidationError", () => {
    try {
      validateTimezone("Invalid/Zone");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(422);
      expect((e as ValidationError).message).toContain("Invalid timezone");
    }
  });

  it("rejects empty string", () => {
    expect(() => validateTimezone("")).toThrow(ValidationError);
  });
});

describe("validateLocale", () => {
  const supported = ["en", "zh-CN", "ja", "ko", "es", "fr", "de", "pt-BR"];

  it("accepts supported locales", () => {
    for (const loc of supported) {
      expect(() => validateLocale(loc, supported)).not.toThrow();
    }
  });

  it("rejects unsupported locale with 422 ValidationError", () => {
    try {
      validateLocale("xx-YY", supported);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(422);
      expect((e as ValidationError).message).toContain("Invalid locale");
    }
  });
});

describe("validateDateFormat", () => {
  it("accepts valid date formats", () => {
    expect(() => validateDateFormat("relative")).not.toThrow();
    expect(() => validateDateFormat("absolute")).not.toThrow();
    expect(() => validateDateFormat("both")).not.toThrow();
  });

  it("rejects invalid date format with 422 ValidationError", () => {
    try {
      validateDateFormat("invalid");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).status).toBe(422);
      expect((e as ValidationError).message).toContain("Invalid dateFormat");
    }
  });
});

// ─── Service with mock DB ───────────────────────────────────────────────────

describe("UserPreferencesService", () => {
  const config = {
    supportedLocales: ["en", "zh-CN", "ja", "ko", "es", "fr", "de", "pt-BR"],
  };

  function createMockDb(rows: any[] = []) {
    const state = {
      insertCalled: false,
      insertValues: null as any,
      conflictSet: null as any,
    };

    const returning = () => (rows.length > 0 ? Promise.resolve(rows) : Promise.resolve([{
      userId: state.insertValues?.userId,
      companyId: state.insertValues?.companyId,
      timezone: state.insertValues?.timezone ?? "UTC",
      locale: state.insertValues?.locale ?? "en",
      dateFormat: state.insertValues?.dateFormat ?? "relative",
      updatedAt: state.insertValues?.updatedAt ?? new Date(),
    }]));

    const onConflictDoUpdate = (opts: any) => {
      state.conflictSet = opts.set;
      return { returning };
    };

    const values = (v: any) => {
      state.insertValues = v;
      return { onConflictDoUpdate, returning };
    };

    const limit = (_n: number) => Promise.resolve(rows);
    const where = (_cond: any) => ({ limit });

    const db = {
      select: () => ({ from: () => ({ where }) }),
      insert: () => ({ values }),
      _state: state,
    };

    return db;
  }

  it("getPreferences returns defaults when no row exists", async () => {
    const db = createMockDb([]);
    const svc = new UserPreferencesService(db, config);

    const prefs = await svc.getPreferences("user-1", "company-1");

    expect(prefs.userId).toBe("user-1");
    expect(prefs.companyId).toBe("company-1");
    expect(prefs.timezone).toBe("UTC");
    expect(prefs.locale).toBe("en");
    expect(prefs.dateFormat).toBe("relative");
  });

  it("getPreferences returns stored row when it exists", async () => {
    const stored = {
      userId: "user-1",
      companyId: "company-1",
      timezone: "Asia/Shanghai",
      locale: "zh-CN",
      dateFormat: "absolute",
      updatedAt: new Date("2024-01-01"),
    };
    const db = createMockDb([stored]);
    const svc = new UserPreferencesService(db, config);

    const prefs = await svc.getPreferences("user-1", "company-1");

    expect(prefs.timezone).toBe("Asia/Shanghai");
    expect(prefs.locale).toBe("zh-CN");
    expect(prefs.dateFormat).toBe("absolute");
  });

  it("upsertPreferences validates timezone before writing", async () => {
    const db = createMockDb();
    const svc = new UserPreferencesService(db, config);

    await expect(
      svc.upsertPreferences("u", "c", { timezone: "Bad/Zone" }),
    ).rejects.toThrow(ValidationError);
  });

  it("upsertPreferences validates locale before writing", async () => {
    const db = createMockDb();
    const svc = new UserPreferencesService(db, config);

    await expect(
      svc.upsertPreferences("u", "c", { locale: "xx" }),
    ).rejects.toThrow(ValidationError);
  });

  it("upsertPreferences validates dateFormat before writing", async () => {
    const db = createMockDb();
    const svc = new UserPreferencesService(db, config);

    await expect(
      svc.upsertPreferences("u", "c", { dateFormat: "nope" }),
    ).rejects.toThrow(ValidationError);
  });

  it("upsertPreferences succeeds with valid patch", async () => {
    const db = createMockDb();
    const svc = new UserPreferencesService(db, config);

    const result = await svc.upsertPreferences("user-1", "company-1", {
      timezone: "America/New_York",
      locale: "en",
      dateFormat: "both",
    });

    expect(result.userId).toBe("user-1");
    expect(result.companyId).toBe("company-1");
    expect(result.timezone).toBe("America/New_York");
  });

  it("uses default supportedLocales when config is empty", async () => {
    const db = createMockDb();
    const svc = new UserPreferencesService(db, {});

    // "en" should be accepted even with empty config (falls back to defaults)
    const result = await svc.upsertPreferences("u", "c", { locale: "en" });
    expect(result).toBeDefined();
  });
});
