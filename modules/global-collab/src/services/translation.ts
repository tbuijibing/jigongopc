import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  modGlobalCollabEntityTranslations,
  modGlobalCollabTranslationCache,
} from "../schema.js";
import {
  createTranslationEngine,
  detectLanguage,
  type TranslationEngine,
} from "./translation-engine.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EntityTranslationRequest {
  companyId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  sourceText: string;
  targetLocale: string;
}

export interface EntityTranslationResult {
  translatedText: string;
  sourceLocale: string;
  targetLocale: string;
  stale: boolean;
  cached: boolean;
}

export interface TextTranslationResult {
  translatedText: string;
  sourceLocale: string;
  targetLocale: string;
  cached: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ─── Service ────────────────────────────────────────────────────────────────

export class TranslationService {
  private engine: TranslationEngine;

  constructor(
    private db: any,
    private config: Record<string, unknown>,
  ) {
    this.engine = createTranslationEngine(config);
  }

  // ── Entity Translation (Task 5.2) ──────────────────────────────────────

  async translateEntityField(
    req: EntityTranslationRequest,
  ): Promise<EntityTranslationResult> {
    const {
      companyId,
      entityType,
      entityId,
      fieldName,
      sourceText,
      targetLocale,
    } = req;
    const sourceHash = sha256(sourceText);

    // Step 1: Check entity_translations cache
    const cached = await this.db
      .select()
      .from(modGlobalCollabEntityTranslations)
      .where(
        and(
          eq(modGlobalCollabEntityTranslations.companyId, companyId),
          eq(modGlobalCollabEntityTranslations.entityType, entityType),
          eq(modGlobalCollabEntityTranslations.entityId, entityId),
          eq(modGlobalCollabEntityTranslations.fieldName, fieldName),
          eq(modGlobalCollabEntityTranslations.locale, targetLocale),
        ),
      )
      .then((rows: any[]) => rows[0] ?? null);

    if (cached && cached.sourceHash === sourceHash) {
      // Cache hit, source unchanged
      return {
        translatedText: cached.translatedText,
        sourceLocale: cached.sourceLocale,
        targetLocale,
        stale: false,
        cached: true,
      };
    }

    // Step 2: Detect source language
    const sourceLocale = await detectLanguage(sourceText);

    // Step 3: Same language → return original
    if (sourceLocale === targetLocale) {
      return {
        translatedText: sourceText,
        sourceLocale,
        targetLocale,
        stale: false,
        cached: false,
      };
    }

    // Step 4: Call translation engine
    const translatedText = await this.engine.translate(
      sourceText,
      sourceLocale,
      targetLocale,
    );

    // Step 5: UPSERT to entity_translations
    await this.db
      .insert(modGlobalCollabEntityTranslations)
      .values({
        companyId,
        entityType,
        entityId,
        fieldName,
        locale: targetLocale,
        sourceLocale,
        translatedText,
        sourceHash,
      })
      .onConflictDoUpdate({
        target: [
          modGlobalCollabEntityTranslations.companyId,
          modGlobalCollabEntityTranslations.entityType,
          modGlobalCollabEntityTranslations.entityId,
          modGlobalCollabEntityTranslations.fieldName,
          modGlobalCollabEntityTranslations.locale,
        ],
        set: {
          translatedText,
          sourceLocale,
          sourceHash,
          updatedAt: new Date(),
        },
      });

    return {
      translatedText,
      sourceLocale,
      targetLocale,
      stale: false,
      cached: false,
    };
  }

  async translateEntityBatch(
    reqs: EntityTranslationRequest[],
  ): Promise<EntityTranslationResult[]> {
    return Promise.all(reqs.map((r) => this.translateEntityField(r)));
  }

  // ── Free-Text Translation (Task 5.3) ──────────────────────────────────

  async translateWithCache(
    companyId: string,
    text: string,
    targetLocale: string,
  ): Promise<TextTranslationResult> {
    // Step 1: Compute content hash
    const contentHash = sha256(`${text}::${targetLocale}`);

    // Step 2: Check translation_cache
    const cached = await this.db
      .select()
      .from(modGlobalCollabTranslationCache)
      .where(
        and(
          eq(modGlobalCollabTranslationCache.companyId, companyId),
          eq(modGlobalCollabTranslationCache.contentHash, contentHash),
        ),
      )
      .then((rows: any[]) => rows[0] ?? null);

    if (cached) {
      return {
        translatedText: cached.translatedText,
        sourceLocale: cached.sourceLocale,
        targetLocale: cached.targetLocale,
        cached: true,
      };
    }

    // Step 3: Detect source language
    const sourceLocale = await detectLanguage(text);

    // Step 4: Same language → return original
    if (sourceLocale === targetLocale) {
      return { translatedText: text, sourceLocale, targetLocale, cached: false };
    }

    // Step 5: Call translation engine
    const translatedText = await this.engine.translate(
      text,
      sourceLocale,
      targetLocale,
    );

    // Step 6: Write to cache
    await this.db
      .insert(modGlobalCollabTranslationCache)
      .values({
        companyId,
        sourceText: text,
        sourceLocale,
        targetLocale,
        translatedText,
        contentHash,
      })
      .onConflictDoNothing();

    return { translatedText, sourceLocale, targetLocale, cached: false };
  }
}
