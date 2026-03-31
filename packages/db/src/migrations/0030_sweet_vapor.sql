CREATE TABLE "workspace_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"permissions" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_agents_workspace_agent_unique" UNIQUE("workspace_id","agent_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_agents" ADD CONSTRAINT "workspace_agents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_agents" ADD CONSTRAINT "workspace_agents_workspace_id_project_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."project_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_agents" ADD CONSTRAINT "workspace_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_agents_company_idx" ON "workspace_agents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "workspace_agents_workspace_idx" ON "workspace_agents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_agents_agent_idx" ON "workspace_agents" USING btree ("agent_id");