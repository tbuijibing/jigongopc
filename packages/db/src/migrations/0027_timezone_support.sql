-- Add timezone support to companies and users tables
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locale" text DEFAULT 'en';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "date_format" text DEFAULT 'relative';
