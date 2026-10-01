CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"actor_id" uuid,
	"system_actor" text,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"result" text NOT NULL,
	"request_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "audit_actor" CHECK (("audit_events"."actor_id" IS NOT NULL AND "audit_events"."system_actor" IS NULL) OR ("audit_events"."actor_id" IS NULL AND "audit_events"."system_actor" IS NOT NULL)),
	CONSTRAINT "audit_result" CHECK ("audit_events"."result" IN ('success','failure')),
	CONSTRAINT "audit_metadata" CHECK (length("audit_events"."metadata"::text) <= 65536)
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"close_reason" text,
	"author_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"closed_at" bigint,
	"last_mutation_id" uuid NOT NULL,
	CONSTRAINT "issue_project_number" UNIQUE("project_id","number"),
	CONSTRAINT "issue_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "issue_number_bound" CHECK ("issues"."number" > 0 AND "issues"."number" <= 2147483647),
	CONSTRAINT "issue_revision" CHECK ("issues"."revision" > 0 AND "issues"."revision" <= 2147483647),
	CONSTRAINT "issue_title_bound" CHECK (length("issues"."title") BETWEEN 1 AND 200 AND "issues"."title" = trim("issues"."title")),
	CONSTRAINT "issue_body_bound" CHECK (length("issues"."body") <= 32768),
	CONSTRAINT "issue_state_consistency" CHECK (("issues"."state" = 'open' AND "issues"."close_reason" IS NULL AND "issues"."closed_at" IS NULL) OR ("issues"."state" = 'closed' AND "issues"."close_reason" IN ('completed','not_planned','duplicate','invalid','cannot_reproduce') AND "issues"."closed_at" IS NOT NULL)),
	CONSTRAINT "issue_time_order" CHECK ("issues"."updated_at" >= "issues"."created_at" AND ("issues"."closed_at" IS NULL OR "issues"."closed_at" >= "issues"."created_at")),
	CONSTRAINT "issue_id" CHECK (substr("issues"."id"::text,15,1) = '4' AND substr("issues"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_mutation_id" CHECK (substr("issues"."last_mutation_id"::text,15,1) = '4' AND substr("issues"."last_mutation_id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_created" CHECK ("issues"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "issue_updated" CHECK ("issues"."updated_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "mutation_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"principal_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"key_hash" text NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	CONSTRAINT "receipt_scope" UNIQUE("principal_id","project_id","operation","key_hash"),
	CONSTRAINT "receipt_hash_length" CHECK (length("mutation_receipts"."key_hash") = 64 AND length("mutation_receipts"."payload_hash") = 64),
	CONSTRAINT "receipt_expiry_bound" CHECK ("mutation_receipts"."expires_at" > "mutation_receipts"."created_at" AND "mutation_receipts"."expires_at" <= "mutation_receipts"."created_at" + 86400000),
	CONSTRAINT "receipt_result" CHECK (length("mutation_receipts"."result"::text) <= 65536)
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	"available_at" bigint NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivered_at" bigint,
	CONSTRAINT "outbox_attempts" CHECK ("outbox"."attempts" >= 0),
	CONSTRAINT "outbox_version" CHECK ("outbox"."event_version" > 0),
	CONSTRAINT "outbox_payload" CHECK (length("outbox"."payload"::text) <= 65536)
);
--> statement-breakpoint
CREATE TABLE "principals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" bigint NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "principal_identity_kind" UNIQUE("id","kind"),
	CONSTRAINT "principal_kind" CHECK ("principals"."kind" IN ('user','staff')),
	CONSTRAINT "principal_status" CHECK ("principals"."status" IN ('active','suspended','deleted')),
	CONSTRAINT "principal_revision" CHECK ("principals"."revision" > 0 AND "principals"."revision" <= 2147483647),
	CONSTRAINT "principal_id" CHECK (substr("principals"."id"::text,15,1) = '4' AND substr("principals"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "principal_created" CHECK ("principals"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"next_issue_number" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "project_visibility" CHECK ("projects"."visibility" IN ('public','private')),
	CONSTRAINT "project_status" CHECK ("projects"."status" IN ('active','archived')),
	CONSTRAINT "project_number_bound" CHECK ("projects"."next_issue_number" >= 1 AND "projects"."next_issue_number" <= 2147483647),
	CONSTRAINT "project_revision" CHECK ("projects"."revision" > 0 AND "projects"."revision" <= 2147483647),
	CONSTRAINT "project_slug" CHECK (length("projects"."slug") BETWEEN 1 AND 63 AND "projects"."slug" = lower("projects"."slug")),
	CONSTRAINT "project_time_order" CHECK ("projects"."updated_at" >= "projects"."created_at"),
	CONSTRAINT "project_id" CHECK (substr("projects"."id"::text,15,1) = '4' AND substr("projects"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "project_created" CHECK ("projects"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "project_updated" CHECK ("projects"."updated_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"aggregate_revision" integer NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" bigint NOT NULL,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "timeline_issue_revision" UNIQUE("issue_id","aggregate_revision"),
	CONSTRAINT "timeline_revision" CHECK ("timeline_events"."aggregate_revision" > 0),
	CONSTRAINT "timeline_metadata" CHECK (length("timeline_events"."metadata"::text) <= 65536)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_principals_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_author_id_principals_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "mutation_receipts_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "mutation_receipts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_actor_id_principals_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_issue_project_fk" FOREIGN KEY ("project_id","issue_id") REFERENCES "public"."issues"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_project_order" ON "audit_events" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX "issue_project_created" ON "issues" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX "issue_project_state_created" ON "issues" USING btree ("project_id","state","created_at","id");--> statement-breakpoint
CREATE INDEX "issue_author" ON "issues" USING btree ("author_id","id");--> statement-breakpoint
CREATE INDEX "receipt_expiry" ON "mutation_receipts" USING btree ("expires_at","id");--> statement-breakpoint
CREATE INDEX "outbox_pending" ON "outbox" USING btree ("delivered_at","available_at","id");--> statement-breakpoint
CREATE INDEX "timeline_issue_order" ON "timeline_events" USING btree ("project_id","issue_id","created_at","id");