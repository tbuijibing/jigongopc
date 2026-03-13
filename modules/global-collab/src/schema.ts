import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ─── 1. User Preferences ────────────────────────────────────────────────────

export const modGlobalCollabUserPreferences = pgTable(
  "mod_global_collab_user_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    userId: text("user_id").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    locale: text("locale").notNull().default("en"),
    dateFormat: text("date_format").notNull().default("relative"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCompanyUniqueIdx: uniqueIndex("mod_gc_user_prefs_user_company_idx").on(
      table.userId,
      table.companyId,
    ),
  }),
);

// ─── 2. Notifications ───────────────────────────────────────────────────────

export const modGlobalCollabNotifications = pgTable(
  "mod_global_collab_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    recipientUserId: text("recipient_user_id").notNull(),
    type: text("type").notNull(), // mention | assignment | status_change | comment | handoff_request
    title: text("title").notNull(),
    body: text("body"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recipientUnreadIdx: index("mod_gc_notif_recipient_unread_idx").on(
      table.companyId,
      table.recipientUserId,
      table.readAt,
    ),
    companyCreatedIdx: index("mod_gc_notif_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
  }),
);


// ─── 3. Entity Translations (business content) ─────────────────────────────

export const modGlobalCollabEntityTranslations = pgTable(
  "mod_global_collab_entity_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    locale: text("locale").notNull(),
    sourceLocale: text("source_locale").notNull(),
    translatedText: text("translated_text").notNull(),
    sourceHash: text("source_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityFieldLocaleIdx: uniqueIndex("mod_gc_entity_trans_field_locale_idx").on(
      table.companyId,
      table.entityType,
      table.entityId,
      table.fieldName,
      table.locale,
    ),
    entityLocaleIdx: index("mod_gc_entity_trans_entity_locale_idx").on(
      table.companyId,
      table.entityType,
      table.entityId,
      table.locale,
    ),
    companyLocaleIdx: index("mod_gc_entity_trans_company_locale_idx").on(
      table.companyId,
      table.locale,
    ),
  }),
);

// ─── 4. Dictionary Translations (global, no companyId) ──────────────────────

export const modGlobalCollabDictionaryTranslations = pgTable(
  "mod_global_collab_dictionary_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category").notNull(),
    key: text("key").notNull(),
    locale: text("locale").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryKeyLocaleIdx: uniqueIndex("mod_gc_dict_trans_cat_key_locale_idx").on(
      table.category,
      table.key,
      table.locale,
    ),
  }),
);

// ─── 5. Translation Cache (free-text cache) ────────────────────────────────

export const modGlobalCollabTranslationCache = pgTable(
  "mod_global_collab_translation_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    sourceText: text("source_text").notNull(),
    sourceLocale: text("source_locale").notNull(),
    targetLocale: text("target_locale").notNull(),
    translatedText: text("translated_text").notNull(),
    contentHash: text("content_hash").notNull(), // SHA-256(sourceText + "::" + targetLocale)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    hashIdx: uniqueIndex("mod_gc_trans_cache_hash_idx").on(
      table.companyId,
      table.contentHash,
    ),
    companyLocaleIdx: index("mod_gc_trans_cache_company_locale_idx").on(
      table.companyId,
      table.targetLocale,
    ),
  }),
);
