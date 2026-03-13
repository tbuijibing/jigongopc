CREATE TABLE "agent_heartbeat_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"interval_sec" integer DEFAULT 300 NOT NULL,
	"wake_on_assignment" boolean DEFAULT true NOT NULL,
	"wake_on_mention" boolean DEFAULT true NOT NULL,
	"wake_on_demand" boolean DEFAULT true NOT NULL,
	"max_concurrent_runs" integer DEFAULT 1 NOT NULL,
	"timeout_sec" integer DEFAULT 600 NOT NULL,
	"cooldown_sec" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"memory_layer" text NOT NULL,
	"scope_id" uuid,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"memory_type" text NOT NULL,
	"importance" integer DEFAULT 50 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"install_type" text NOT NULL,
	"installed_by" text,
	"config" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_souls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"system_prompt" text NOT NULL,
	"personality" text,
	"constraints" text,
	"output_format" text,
	"language" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"tool_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "human_agent_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"depends_on_issue_id" uuid NOT NULL,
	"dependency_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_watchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"watcher_type" text NOT NULL,
	"watcher_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"category" text NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"author" text,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "capabilities" SET DATA TYPE jsonb USING capabilities::jsonb;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "issue_type" text DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_heartbeat_configs" ADD CONSTRAINT "agent_heartbeat_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_heartbeat_configs" ADD CONSTRAINT "agent_heartbeat_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skill_id_skill_registry_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_souls" ADD CONSTRAINT "agent_souls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_souls" ADD CONSTRAINT "agent_souls_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_agent_controls" ADD CONSTRAINT "human_agent_controls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_agent_controls" ADD CONSTRAINT "human_agent_controls_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_dependencies" ADD CONSTRAINT "issue_dependencies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_dependencies" ADD CONSTRAINT "issue_dependencies_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_dependencies" ADD CONSTRAINT "issue_dependencies_depends_on_issue_id_issues_id_fk" FOREIGN KEY ("depends_on_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_registry" ADD CONSTRAINT "skill_registry_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_heartbeat_configs_company_agent_uq" ON "agent_heartbeat_configs" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_heartbeat_configs_company_idx" ON "agent_heartbeat_configs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "agent_memories_company_agent_layer_scope_idx" ON "agent_memories" USING btree ("company_id","agent_id","memory_layer","scope_id");--> statement-breakpoint
CREATE INDEX "agent_memories_company_agent_key_idx" ON "agent_memories" USING btree ("company_id","agent_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_skills_company_agent_skill_uq" ON "agent_skills" USING btree ("company_id","agent_id","skill_id");--> statement-breakpoint
CREATE INDEX "agent_skills_company_agent_idx" ON "agent_skills" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_souls_company_agent_uq" ON "agent_souls" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_souls_company_idx" ON "agent_souls" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "agent_tools_company_agent_idx" ON "agent_tools" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_tools_company_agent_tool_type_idx" ON "agent_tools" USING btree ("company_id","agent_id","tool_type");--> statement-breakpoint
CREATE UNIQUE INDEX "human_agent_controls_user_agent_uq" ON "human_agent_controls" USING btree ("user_id","agent_id");--> statement-breakpoint
CREATE INDEX "human_agent_controls_company_user_idx" ON "human_agent_controls" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "human_agent_controls_company_agent_idx" ON "human_agent_controls" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_dependencies_issue_depends_on_uq" ON "issue_dependencies" USING btree ("issue_id","depends_on_issue_id");--> statement-breakpoint
CREATE INDEX "issue_dependencies_company_issue_idx" ON "issue_dependencies" USING btree ("company_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_dependencies_company_depends_on_idx" ON "issue_dependencies" USING btree ("company_id","depends_on_issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_watchers_issue_type_watcher_uq" ON "issue_watchers" USING btree ("issue_id","watcher_type","watcher_id");--> statement-breakpoint
CREATE INDEX "issue_watchers_company_issue_idx" ON "issue_watchers" USING btree ("company_id","issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_registry_company_slug_uq" ON "skill_registry" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "skill_registry_company_idx" ON "skill_registry" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "issues_company_issue_type_idx" ON "issues" USING btree ("company_id","issue_type");