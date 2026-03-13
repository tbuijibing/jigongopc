import { eq, and } from "drizzle-orm";
import { modGlobalCollabUserPreferences } from "../schema.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserPreferences {
  userId: string;
  companyId: string;
  timezone: string;
  locale: string;
  dateFormat: string;
  updatedAt: Date;
}

export interface PreferencesPatch {
  timezone: string;
  locale: string;
  dateFormat: string;
}

export class ValidationError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
    this.status = 422;
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULTS: Omit<UserPreferences, "userId" | "companyId" | "updatedAt"> = {
  timezone: "UTC",
  locale: "en",
  dateFormat: "relative",
};

const VALID_DATE_FORMATS = ["relative", "absolute", "both"] as const;

const DEFAULT_SUPPORTED_LOCALES = ["en", "zh-CN", "ja", "ko", "es", "fr", "de", "pt-BR"];

// ─── Service ────────────────────────────────────────────────────────────────

export class UserPreferencesService {
  constructor(
    private db: any,
    private config: Record<string, unknown>,
  ) {}

  async getPreferences(userId: string, companyId: string): Promise<UserPreferences> {
    const rows = await this.db
      .select()
      .from(modGlobalCollabUserPreferences)
      .where(
        and(
          eq(modGlobalCollabUserPreferences.userId, userId),
          eq(modGlobalCollabUserPreferences.companyId, companyId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return {
        userId,
        companyId,
        ...DEFAULTS,
        updatedAt: new Date(),
      };
    }

    return {
      userId: row.userId,
      companyId: row.companyId,
      timezone: row.timezone,
      locale: row.locale,
      dateFormat: row.dateFormat,
      updatedAt: row.updatedAt,
    };
  }

  async upsertPreferences(
    userId: string,
    companyId: string,
    patch: Partial<PreferencesPatch>,
  ): Promise<UserPreferences> {
    // Validate fields present in the patch
    if (patch.timezone !== undefined) {
      validateTimezone(patch.timezone);
    }
    if (patch.locale !== undefined) {
      validateLocale(patch.locale, this.getSupportedLocales());
    }
    if (patch.dateFormat !== undefined) {
      validateDateFormat(patch.dateFormat);
    }

    const now = new Date();

    const values = {
      userId,
      companyId,
      timezone: patch.timezone ?? DEFAULTS.timezone,
      locale: patch.locale ?? DEFAULTS.locale,
      dateFormat: patch.dateFormat ?? DEFAULTS.dateFormat,
      updatedAt: now,
    };

    const rows = await this.db
      .insert(modGlobalCollabUserPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: [
          modGlobalCollabUserPreferences.userId,
          modGlobalCollabUserPreferences.companyId,
        ],
        set: {
          ...(patch.timezone !== undefined && { timezone: patch.timezone }),
          ...(patch.locale !== undefined && { locale: patch.locale }),
          ...(patch.dateFormat !== undefined && { dateFormat: patch.dateFormat }),
          updatedAt: now,
        },
      })
      .returning();

    const row = rows[0];
    return {
      userId: row.userId,
      companyId: row.companyId,
      timezone: row.timezone,
      locale: row.locale,
      dateFormat: row.dateFormat,
      updatedAt: row.updatedAt,
    };
  }

  private getSupportedLocales(): string[] {
    const locales = this.config.supportedLocales;
    if (Array.isArray(locales) && locales.length > 0) {
      return locales as string[];
    }
    return DEFAULT_SUPPORTED_LOCALES;
  }
}

// ─── Validation helpers (exported for testing) ──────────────────────────────

export function validateTimezone(tz: string): void {
  // "UTC" and "GMT" are valid IANA identifiers but not returned by
  // Intl.supportedValuesOf("timeZone") in all runtimes.
  if (tz === "UTC" || tz === "GMT") return;

  const supported = Intl.supportedValuesOf("timeZone");
  if (!supported.includes(tz)) {
    throw new ValidationError(
      `Invalid timezone "${tz}". Must be a valid IANA timezone identifier.`,
    );
  }
}

export function validateLocale(locale: string, supportedLocales: string[]): void {
  if (!supportedLocales.includes(locale)) {
    throw new ValidationError(
      `Invalid locale "${locale}". Supported locales: ${supportedLocales.join(", ")}`,
    );
  }
}

export function validateDateFormat(format: string): void {
  if (!(VALID_DATE_FORMATS as readonly string[]).includes(format)) {
    throw new ValidationError(
      `Invalid dateFormat "${format}". Must be one of: ${VALID_DATE_FORMATS.join(", ")}`,
    );
  }
}
