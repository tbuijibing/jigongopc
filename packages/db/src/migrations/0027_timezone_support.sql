-- Add timezone support to companies and users tables
ALTER TABLE "companies" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "locale" text DEFAULT 'en';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "date_format" text DEFAULT 'relative';
