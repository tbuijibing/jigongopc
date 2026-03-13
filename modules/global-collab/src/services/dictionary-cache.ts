import { eq } from "drizzle-orm";
import { modGlobalCollabDictionaryTranslations } from "../schema.js";

export class DictionaryTranslationCache {
  private db: any;
  // In-memory cache: Map<locale, Map<category, Map<key, label>>>
  private cache = new Map<string, Map<string, Map<string, string>>>();
  private loadedLocales = new Set<string>();

  constructor(db: any) {
    this.db = db;
  }

  /** Ensure all translations for a locale are loaded into memory */
  async ensureLoaded(locale: string): Promise<void> {
    if (this.loadedLocales.has(locale)) return;

    const rows = await this.db
      .select()
      .from(modGlobalCollabDictionaryTranslations)
      .where(eq(modGlobalCollabDictionaryTranslations.locale, locale));

    const localeMap = new Map<string, Map<string, string>>();
    for (const row of rows) {
      if (!localeMap.has(row.category)) {
        localeMap.set(row.category, new Map());
      }
      localeMap.get(row.category)!.set(row.key, row.label);
    }

    this.cache.set(locale, localeMap);
    this.loadedLocales.add(locale);
  }

  /** Get a single dictionary label. Returns the key itself as fallback. */
  async getDictionaryLabel(category: string, key: string, locale: string): Promise<string> {
    await this.ensureLoaded(locale);
    return this.cache.get(locale)?.get(category)?.get(key) ?? key;
  }

  /** Get all labels for a category in a locale */
  async getDictionaryLabels(category: string, locale: string): Promise<Record<string, string>> {
    await this.ensureLoaded(locale);
    const categoryMap = this.cache.get(locale)?.get(category);
    if (!categoryMap) return {};
    return Object.fromEntries(categoryMap);
  }

  /** Get all dictionaries for a locale */
  async getAllDictionaries(locale: string): Promise<Record<string, Record<string, string>>> {
    await this.ensureLoaded(locale);
    const localeMap = this.cache.get(locale);
    if (!localeMap) return {};
    const result: Record<string, Record<string, string>> = {};
    for (const [category, entries] of localeMap) {
      result[category] = Object.fromEntries(entries);
    }
    return result;
  }

  /** Clear cached data for a specific locale or all locales */
  invalidate(locale?: string): void {
    if (locale) {
      this.cache.delete(locale);
      this.loadedLocales.delete(locale);
    } else {
      this.cache.clear();
      this.loadedLocales.clear();
    }
  }
}
