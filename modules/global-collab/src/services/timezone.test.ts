import { describe, it, expect } from "vitest";
import { resolveDisplayTimestamp } from "./timezone.js";

describe("resolveDisplayTimestamp", () => {
  const utc = "2024-01-15T06:30:00.000Z";
  const now = new Date("2024-01-15T09:30:00.000Z"); // 3 hours later

  it('returns relative time for "relative" format', () => {
    const result = resolveDisplayTimestamp(utc, "Asia/Shanghai", "relative", now);
    expect(result).toContain("3");
    expect(result).toContain("ago");
  });

  it('returns absolute time with timezone for "absolute" format', () => {
    const result = resolveDisplayTimestamp(utc, "Asia/Shanghai", "absolute");
    // 06:30 UTC = 14:30 CST (Asia/Shanghai is UTC+8)
    expect(result).toContain("2024-01-15");
    expect(result).toContain("14:30");
  });

  it('returns combined relative + absolute for "both" format', () => {
    const result = resolveDisplayTimestamp(utc, "Asia/Shanghai", "both", now);
    expect(result).toContain("ago");
    expect(result).toContain("(");
    expect(result).toContain("2024-01-15");
    expect(result).toContain("14:30");
  });

  it("returns non-empty string for all formats", () => {
    for (const fmt of ["relative", "absolute", "both"] as const) {
      const result = resolveDisplayTimestamp(utc, "UTC", fmt, now);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("handles different timezones correctly", () => {
    const nyResult = resolveDisplayTimestamp(utc, "America/New_York", "absolute");
    // 06:30 UTC = 01:30 EST (UTC-5)
    expect(nyResult).toContain("01:30");

    const tokyoResult = resolveDisplayTimestamp(utc, "Asia/Tokyo", "absolute");
    // 06:30 UTC = 15:30 JST (UTC+9)
    expect(tokyoResult).toContain("15:30");
  });
});
