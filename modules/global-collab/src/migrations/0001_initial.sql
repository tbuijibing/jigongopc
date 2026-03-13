-- Global Collaboration Module - Initial Migration
-- Creates all mod_global_collab_* tables

-- 1. User Preferences
CREATE TABLE IF NOT EXISTS mod_global_collab_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en',
  date_format TEXT NOT NULL DEFAULT 'relative',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mod_gc_user_prefs_user_company_idx
  ON mod_global_collab_user_preferences (user_id, company_id);

-- 2. Notifications
CREATE TABLE IF NOT EXISTS mod_global_collab_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mod_gc_notif_recipient_unread_idx
  ON mod_global_collab_notifications (company_id, recipient_user_id, read_at);

CREATE INDEX IF NOT EXISTS mod_gc_notif_company_created_idx
  ON mod_global_collab_notifications (company_id, created_at);

-- 3. Entity Translations
CREATE TABLE IF NOT EXISTS mod_global_collab_entity_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  locale TEXT NOT NULL,
  source_locale TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mod_gc_entity_trans_field_locale_idx
  ON mod_global_collab_entity_translations (company_id, entity_type, entity_id, field_name, locale);

CREATE INDEX IF NOT EXISTS mod_gc_entity_trans_entity_locale_idx
  ON mod_global_collab_entity_translations (company_id, entity_type, entity_id, locale);

CREATE INDEX IF NOT EXISTS mod_gc_entity_trans_company_locale_idx
  ON mod_global_collab_entity_translations (company_id, locale);

-- 4. Dictionary Translations (global, no company_id)
CREATE TABLE IF NOT EXISTS mod_global_collab_dictionary_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  locale TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mod_gc_dict_trans_cat_key_locale_idx
  ON mod_global_collab_dictionary_translations (category, key, locale);

-- 5. Translation Cache
CREATE TABLE IF NOT EXISTS mod_global_collab_translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  source_text TEXT NOT NULL,
  source_locale TEXT NOT NULL,
  target_locale TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mod_gc_trans_cache_hash_idx
  ON mod_global_collab_translation_cache (company_id, content_hash);

CREATE INDEX IF NOT EXISTS mod_gc_trans_cache_company_locale_idx
  ON mod_global_collab_translation_cache (company_id, target_locale);
