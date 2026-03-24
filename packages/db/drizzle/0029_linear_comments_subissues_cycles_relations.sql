CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_provider" text NOT NULL,
	"body" text NOT NULL,
	"author_external_id" text,
	"author_name" text,
	"author_avatar_url" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "task_comments_org_provider_external_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "task_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"related_task_id" uuid,
	"related_external_id" text,
	"type" text NOT NULL,
	"external_id" text NOT NULL,
	"external_provider" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "task_relations_org_provider_external_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "parent_external_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "cycle_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "cycle_name" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "cycle_number" integer;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_related_task_id_tasks_id_fk" FOREIGN KEY ("related_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_comments_task_id_idx" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_comments_organization_id_idx" ON "task_comments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "task_relations_task_id_idx" ON "task_relations" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_relations_organization_id_idx" ON "task_relations" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;