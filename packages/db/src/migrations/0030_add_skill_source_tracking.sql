-- Add source tracking columns to skill_registry table
-- These columns are needed for external skill installation (GitHub, skill.sh, SkillHub)

-- Add source_type column
ALTER TABLE "skill_registry" ADD COLUMN IF NOT EXISTS "source_type" text;

-- Add source_url column
ALTER TABLE "skill_registry" ADD COLUMN IF NOT EXISTS "source_url" text;

-- Add external_id column
ALTER TABLE "skill_registry" ADD COLUMN IF NOT EXISTS "external_id" text;

-- Add last_synced_at column
ALTER TABLE "skill_registry" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp with time zone;

-- Create skill_sources table for tracking external skill sources
CREATE TABLE IF NOT EXISTS "skill_sources" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid NOT NULL,
    "skill_registry_id" uuid,
    "source_type" text NOT NULL,
    "source_url" text NOT NULL,
    "external_id" text,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "description" text,
    "github_owner" text,
    "github_repo" text,
    "github_path" text,
    "github_branch" text DEFAULT 'main',
    "version" text NOT NULL DEFAULT '1.0.0',
    "external_version" text,
    "author" text,
    "category" text,
    "last_synced_at" timestamp with time zone,
    "sync_status" text DEFAULT 'pending',
    "sync_error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE "skill_sources" ADD CONSTRAINT "skill_sources_company_id_companies_id_fk" 
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") 
    ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "skill_sources" ADD CONSTRAINT "skill_sources_skill_registry_id_skill_registry_id_fk" 
    FOREIGN KEY ("skill_registry_id") REFERENCES "public"."skill_registry"("id") 
    ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for skill_sources
CREATE UNIQUE INDEX IF NOT EXISTS "skill_sources_company_source_uq" 
ON "skill_sources" USING btree ("company_id","source_type","external_id");

CREATE INDEX IF NOT EXISTS "skill_sources_company_idx" 
ON "skill_sources" USING btree ("company_id");

CREATE INDEX IF NOT EXISTS "skill_sources_registry_idx" 
ON "skill_sources" USING btree ("skill_registry_id");

CREATE INDEX IF NOT EXISTS "skill_sources_sync_status_idx" 
ON "skill_sources" USING btree ("sync_status");
