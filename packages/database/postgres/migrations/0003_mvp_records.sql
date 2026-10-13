CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"upload_intent_id" uuid NOT NULL,
	"issue_id" uuid,
	"comment_id" uuid,
	"object_key" text NOT NULL,
	"object_version" text NOT NULL,
	"checksum" text NOT NULL,
	"media_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"policy_state" text DEFAULT 'pending' NOT NULL,
	"created_at" bigint NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "attachments_upload_intent_id_unique" UNIQUE("upload_intent_id"),
	CONSTRAINT "attachment_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "attachment_one_target" CHECK (("attachments"."issue_id" IS NOT NULL AND "attachments"."comment_id" IS NULL) OR ("attachments"."issue_id" IS NULL AND "attachments"."comment_id" IS NOT NULL)),
	CONSTRAINT "attachment_policy_state" CHECK ("attachments"."policy_state" IN ('pending','ready','quarantined','deleted')),
	CONSTRAINT "attachment_size" CHECK ("attachments"."size_bytes" BETWEEN 0 AND 9007199254740991 AND cast("attachments"."size_bytes" as bigint) = "attachments"."size_bytes"),
	CONSTRAINT "attachment_object" CHECK (length("attachments"."object_key") BETWEEN 1 AND 1024 AND length("attachments"."object_version") BETWEEN 1 AND 1024 AND length("attachments"."checksum") BETWEEN 1 AND 128 AND length("attachments"."media_type") BETWEEN 1 AND 255),
	CONSTRAINT "attachment_id" CHECK (substr("attachments"."id"::text,15,1) = '4' AND substr("attachments"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "attachment_revision" CHECK ("attachments"."revision" BETWEEN 1 AND 2147483647 AND cast("attachments"."revision" as integer) = "attachments"."revision"),
	CONSTRAINT "attachment_created" CHECK ("attachments"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "comment_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"editor_id" uuid NOT NULL,
	"body" text NOT NULL,
	"changed_at" bigint NOT NULL,
	CONSTRAINT "comment_history_revision" UNIQUE("comment_id","revision"),
	CONSTRAINT "comment_history_id" CHECK (substr("comment_history"."id"::text,15,1) = '4' AND substr("comment_history"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "comment_history_revision_bound" CHECK ("comment_history"."revision" BETWEEN 1 AND 2147483647 AND cast("comment_history"."revision" as integer) = "comment_history"."revision"),
	CONSTRAINT "comment_history_changed" CHECK ("comment_history"."changed_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "comment_history_body" CHECK (length("comment_history"."body") <= 32768)
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"moderation" text DEFAULT 'visible' NOT NULL,
	"deleted_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "comment_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "comment_issue_id" UNIQUE("project_id","issue_id","id"),
	CONSTRAINT "comment_id" CHECK (substr("comments"."id"::text,15,1) = '4' AND substr("comments"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "comment_revision" CHECK ("comments"."revision" BETWEEN 1 AND 2147483647 AND cast("comments"."revision" as integer) = "comments"."revision"),
	CONSTRAINT "comment_body" CHECK (length("comments"."body") <= 32768),
	CONSTRAINT "comment_moderation" CHECK ("comments"."moderation" IN ('visible','hidden','redacted')),
	CONSTRAINT "comment_created" CHECK ("comments"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "comment_updated" CHECK ("comments"."updated_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "comment_deleted" CHECK ("comments"."deleted_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "comment_time_order" CHECK ("comments"."updated_at" >= "comments"."created_at" AND ("comments"."deleted_at" IS NULL OR "comments"."deleted_at" >= "comments"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"form_version" integer NOT NULL,
	"values" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "form_submissions_project_id_issue_id_pk" PRIMARY KEY("project_id","issue_id"),
	CONSTRAINT "form_submission_values" CHECK (length("form_submissions"."values"::text) <= 65536),
	CONSTRAINT "form_submission_created" CHECK ("form_submissions"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"principal_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "identity_external_subject" UNIQUE("provider","issuer","subject"),
	CONSTRAINT "identity_id" CHECK (substr("identities"."id"::text,15,1) = '4' AND substr("identities"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "identity_created" CHECK ("identities"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "identity_provider_bound" CHECK (length("identities"."provider") BETWEEN 1 AND 100),
	CONSTRAINT "identity_issuer_bound" CHECK (length("identities"."issuer") BETWEEN 1 AND 1024),
	CONSTRAINT "identity_subject_bound" CHECK (length("identities"."subject") BETWEEN 1 AND 1024)
);
--> statement-breakpoint
CREATE TABLE "issue_assignees" (
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	CONSTRAINT "issue_assignees_project_id_issue_id_principal_id_pk" PRIMARY KEY("project_id","issue_id","principal_id")
);
--> statement-breakpoint
CREATE TABLE "issue_form_versions" (
	"project_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "issue_form_versions_project_id_form_id_version_pk" PRIMARY KEY("project_id","form_id","version"),
	CONSTRAINT "form_version_bound" CHECK ("issue_form_versions"."version" BETWEEN 1 AND 2147483647 AND cast("issue_form_versions"."version" as integer) = "issue_form_versions"."version"),
	CONSTRAINT "form_schema_version" CHECK ("issue_form_versions"."schema_version" BETWEEN 1 AND 2147483647 AND cast("issue_form_versions"."schema_version" as integer) = "issue_form_versions"."schema_version"),
	CONSTRAINT "form_definition" CHECK (length("issue_form_versions"."definition"::text) <= 65536),
	CONSTRAINT "form_version_created" CHECK ("issue_form_versions"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "issue_forms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "issue_form_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "issue_form_id" CHECK (substr("issue_forms"."id"::text,15,1) = '4' AND substr("issue_forms"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_form_revision" CHECK ("issue_forms"."revision" BETWEEN 1 AND 2147483647 AND cast("issue_forms"."revision" as integer) = "issue_forms"."revision"),
	CONSTRAINT "issue_form_enabled" CHECK ("issue_forms"."enabled" IN (0,1)),
	CONSTRAINT "issue_form_name" CHECK (length("issue_forms"."name") BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "issue_labels" (
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "issue_labels_project_id_issue_id_label_id_pk" PRIMARY KEY("project_id","issue_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "issue_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "issue_template_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "issue_template_id" CHECK (substr("issue_templates"."id"::text,15,1) = '4' AND substr("issue_templates"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_template_revision" CHECK ("issue_templates"."revision" BETWEEN 1 AND 2147483647 AND cast("issue_templates"."revision" as integer) = "issue_templates"."revision"),
	CONSTRAINT "issue_template_enabled" CHECK ("issue_templates"."enabled" IN (0,1)),
	CONSTRAINT "issue_template_name" CHECK (length("issue_templates"."name") BETWEEN 1 AND 100),
	CONSTRAINT "issue_template_body" CHECK (length("issue_templates"."body") <= 32768)
);
--> statement-breakpoint
CREATE TABLE "issue_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "issue_type_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "issue_type_project_name" UNIQUE("project_id","name_key"),
	CONSTRAINT "issue_type_id" CHECK (substr("issue_types"."id"::text,15,1) = '4' AND substr("issue_types"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_type_revision" CHECK ("issue_types"."revision" BETWEEN 1 AND 2147483647 AND cast("issue_types"."revision" as integer) = "issue_types"."revision"),
	CONSTRAINT "issue_type_name" CHECK (length("issue_types"."name") BETWEEN 1 AND 100 AND length("issue_types"."name_key") BETWEEN 1 AND 200),
	CONSTRAINT "issue_type_position" CHECK ("issue_types"."position" BETWEEN 0 AND 2147483647 AND cast("issue_types"."position" as integer) = "issue_types"."position"),
	CONSTRAINT "issue_type_enabled" CHECK ("issue_types"."enabled" IN (0,1)),
	CONSTRAINT "issue_type_description" CHECK (length("issue_types"."description") <= 4096),
	CONSTRAINT "issue_type_icon" CHECK (length("issue_types"."icon") <= 100),
	CONSTRAINT "issue_type_color" CHECK (length("issue_types"."color") <= 32)
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "label_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "label_project_name" UNIQUE("project_id","name_key"),
	CONSTRAINT "label_id" CHECK (substr("labels"."id"::text,15,1) = '4' AND substr("labels"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "label_revision" CHECK ("labels"."revision" BETWEEN 1 AND 2147483647 AND cast("labels"."revision" as integer) = "labels"."revision"),
	CONSTRAINT "label_name" CHECK (length("labels"."name") BETWEEN 1 AND 100 AND length("labels"."name_key") BETWEEN 1 AND 200),
	CONSTRAINT "label_description" CHECK (length("labels"."description") <= 4096),
	CONSTRAINT "label_color" CHECK (length("labels"."color") <= 32)
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"due_date" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "milestone_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "milestone_id" CHECK (substr("milestones"."id"::text,15,1) = '4' AND substr("milestones"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "milestone_revision" CHECK ("milestones"."revision" BETWEEN 1 AND 2147483647 AND cast("milestones"."revision" as integer) = "milestones"."revision"),
	CONSTRAINT "milestone_title" CHECK (length("milestones"."title") BETWEEN 1 AND 200),
	CONSTRAINT "milestone_description" CHECK (length("milestones"."description") <= 32768),
	CONSTRAINT "milestone_state" CHECK ("milestones"."state" IN ('open','closed')),
	CONSTRAINT "milestone_date_shape" CHECK ("milestones"."due_date" IS NULL OR (length("milestones"."due_date") = 10 AND substr("milestones"."due_date",5,1) = '-' AND substr("milestones"."due_date",8,1) = '-')),
	CONSTRAINT "milestone_created" CHECK ("milestones"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "milestone_updated" CHECK ("milestones"."updated_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "milestone_time_order" CHECK ("milestones"."updated_at" >= "milestones"."created_at")
);
--> statement-breakpoint
CREATE TABLE "plugin_installations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"scope_key" text NOT NULL,
	"plugin_id" text NOT NULL,
	"plugin_version" text NOT NULL,
	"manifest_version" integer NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "plugin_installation_scope_id" UNIQUE("scope_key","id"),
	CONSTRAINT "plugin_installation_scope_plugin" UNIQUE("scope_key","plugin_id"),
	CONSTRAINT "plugin_installation_scope" CHECK ("plugin_installations"."scope_key" = coalesce(cast("plugin_installations"."project_id" as text), 'deployment')),
	CONSTRAINT "plugin_installation_names" CHECK (length("plugin_installations"."plugin_id") BETWEEN 1 AND 100 AND length("plugin_installations"."plugin_version") BETWEEN 1 AND 100),
	CONSTRAINT "plugin_installation_id" CHECK (substr("plugin_installations"."id"::text,15,1) = '4' AND substr("plugin_installations"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "plugin_installation_enabled" CHECK ("plugin_installations"."enabled" IN (0,1)),
	CONSTRAINT "plugin_installation_revision" CHECK ("plugin_installations"."revision" BETWEEN 1 AND 2147483647 AND cast("plugin_installations"."revision" as integer) = "plugin_installations"."revision"),
	CONSTRAINT "plugin_manifest_version" CHECK ("plugin_installations"."manifest_version" BETWEEN 1 AND 2147483647 AND cast("plugin_installations"."manifest_version" as integer) = "plugin_installations"."manifest_version"),
	CONSTRAINT "plugin_installation_created" CHECK ("plugin_installations"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "plugin_metadata" (
	"installation_id" uuid NOT NULL,
	"scope_key" text NOT NULL,
	"namespace" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "plugin_metadata_installation_id_namespace_owner_type_owner_id_key_pk" PRIMARY KEY("installation_id","namespace","owner_type","owner_id","key"),
	CONSTRAINT "plugin_metadata_names" CHECK (length("plugin_metadata"."namespace") BETWEEN 1 AND 100 AND length("plugin_metadata"."owner_type") BETWEEN 1 AND 100 AND length("plugin_metadata"."key") BETWEEN 1 AND 100),
	CONSTRAINT "plugin_metadata_owner_id" CHECK (substr("plugin_metadata"."owner_id"::text,15,1) = '4' AND substr("plugin_metadata"."owner_id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "plugin_metadata_schema_version" CHECK ("plugin_metadata"."schema_version" BETWEEN 1 AND 2147483647 AND cast("plugin_metadata"."schema_version" as integer) = "plugin_metadata"."schema_version"),
	CONSTRAINT "plugin_metadata_revision" CHECK ("plugin_metadata"."revision" BETWEEN 1 AND 2147483647 AND cast("plugin_metadata"."revision" as integer) = "plugin_metadata"."revision"),
	CONSTRAINT "plugin_metadata_value" CHECK (length("plugin_metadata"."value"::text) <= 65536)
);
--> statement-breakpoint
CREATE TABLE "project_roles" (
	"project_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"principal_kind" text DEFAULT 'staff' NOT NULL,
	"role" text NOT NULL,
	"granted_at" bigint NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "project_roles_project_id_principal_id_pk" PRIMARY KEY("project_id","principal_id"),
	CONSTRAINT "project_role_staff" CHECK ("project_roles"."principal_kind" = 'staff'),
	CONSTRAINT "project_role_name" CHECK ("project_roles"."role" IN ('triage','maintainer','administrator')),
	CONSTRAINT "project_role_granted" CHECK ("project_roles"."granted_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "project_role_revision" CHECK ("project_roles"."revision" BETWEEN 1 AND 2147483647 AND cast("project_roles"."revision" as integer) = "project_roles"."revision")
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid,
	"comment_id" uuid,
	"principal_id" uuid NOT NULL,
	"reaction" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "reaction_issue_actor" UNIQUE("issue_id","principal_id","reaction"),
	CONSTRAINT "reaction_comment_actor" UNIQUE("comment_id","principal_id","reaction"),
	CONSTRAINT "reaction_one_target" CHECK (("reactions"."issue_id" IS NOT NULL AND "reactions"."comment_id" IS NULL) OR ("reactions"."issue_id" IS NULL AND "reactions"."comment_id" IS NOT NULL)),
	CONSTRAINT "reaction_allowlist" CHECK ("reactions"."reaction" IN ('thumbs_up','thumbs_down','laugh','hooray','confused','heart','rocket','eyes')),
	CONSTRAINT "reaction_id" CHECK (substr("reactions"."id"::text,15,1) = '4' AND substr("reactions"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "reaction_created" CHECK ("reactions"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "upload_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"media_type" text NOT NULL,
	"max_bytes" bigint NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"verified_object_version" text,
	"verified_checksum" text,
	"actual_bytes" bigint,
	CONSTRAINT "upload_intents_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "upload_intent_project_id" UNIQUE("project_id","id"),
	CONSTRAINT "upload_intent_id" CHECK (substr("upload_intents"."id"::text,15,1) = '4' AND substr("upload_intents"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "upload_intent_revision" CHECK ("upload_intents"."revision" BETWEEN 1 AND 2147483647 AND cast("upload_intents"."revision" as integer) = "upload_intents"."revision"),
	CONSTRAINT "upload_intent_created" CHECK ("upload_intents"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "upload_intent_expires" CHECK ("upload_intents"."expires_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "upload_intent_expiry_bound" CHECK ("upload_intents"."expires_at" > "upload_intents"."created_at"),
	CONSTRAINT "upload_intent_size" CHECK ("upload_intents"."max_bytes" BETWEEN 1 AND 9007199254740991 AND cast("upload_intents"."max_bytes" as bigint) = "upload_intents"."max_bytes" AND ("upload_intents"."actual_bytes" IS NULL OR ("upload_intents"."actual_bytes" BETWEEN 0 AND "upload_intents"."max_bytes" AND cast("upload_intents"."actual_bytes" as bigint) = "upload_intents"."actual_bytes"))),
	CONSTRAINT "upload_intent_state" CHECK ("upload_intents"."state" IN ('pending','uploaded','finalized','expired','rejected')),
	CONSTRAINT "upload_intent_finalized" CHECK ("upload_intents"."state" != 'finalized' OR ("upload_intents"."verified_object_version" IS NOT NULL AND "upload_intents"."verified_checksum" IS NOT NULL AND "upload_intents"."actual_bytes" IS NOT NULL)),
	CONSTRAINT "upload_intent_key" CHECK (length("upload_intents"."object_key") BETWEEN 1 AND 1024),
	CONSTRAINT "upload_intent_media_type" CHECK (length("upload_intents"."media_type") BETWEEN 1 AND 255),
	CONSTRAINT "upload_intent_version_bound" CHECK (length("upload_intents"."verified_object_version") <= 1024),
	CONSTRAINT "upload_intent_checksum_bound" CHECK (length("upload_intents"."verified_checksum") <= 128)
);
--> statement-breakpoint
ALTER TABLE "timeline_events" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "type_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "milestone_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "moderation" text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "deleted_at" bigint;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "system_actor" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachment_intent_project_fk" FOREIGN KEY ("project_id","upload_intent_id") REFERENCES "public"."upload_intents"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachment_issue_project_fk" FOREIGN KEY ("project_id","issue_id") REFERENCES "public"."issues"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachment_comment_project_fk" FOREIGN KEY ("project_id","comment_id") REFERENCES "public"."comments"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_history" ADD CONSTRAINT "comment_history_editor_id_principals_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_history" ADD CONSTRAINT "comment_history_project_fk" FOREIGN KEY ("project_id","comment_id") REFERENCES "public"."comments"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_principals_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comment_issue_project_fk" FOREIGN KEY ("project_id","issue_id") REFERENCES "public"."issues"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submission_issue_fk" FOREIGN KEY ("project_id","issue_id") REFERENCES "public"."issues"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submission_version_fk" FOREIGN KEY ("project_id","form_id","form_version") REFERENCES "public"."issue_form_versions"("project_id","form_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignee_issue_fk" FOREIGN KEY ("project_id","issue_id") REFERENCES "public"."issues"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignee_member_fk" FOREIGN KEY ("project_id","principal_id") REFERENCES "public"."project_roles"("project_id","principal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_form_versions" ADD CONSTRAINT "form_version_project_fk" FOREIGN KEY ("project_id","form_id") REFERENCES "public"."issue_forms"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_forms" ADD CONSTRAINT "issue_forms_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_label_issue_fk" FOREIGN KEY ("project_id","issue_id") REFERENCES "public"."issues"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_label_label_fk" FOREIGN KEY ("project_id","label_id") REFERENCES "public"."labels"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_types" ADD CONSTRAINT "issue_types_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_installations" ADD CONSTRAINT "plugin_installations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_metadata" ADD CONSTRAINT "plugin_metadata_scope_fk" FOREIGN KEY ("scope_key","installation_id") REFERENCES "public"."plugin_installations"("scope_key","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_roles" ADD CONSTRAINT "project_roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_roles" ADD CONSTRAINT "project_role_staff_fk" FOREIGN KEY ("principal_id","principal_kind") REFERENCES "public"."principals"("id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reaction_issue_project_fk" FOREIGN KEY ("project_id","issue_id") REFERENCES "public"."issues"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reaction_comment_project_fk" FOREIGN KEY ("project_id","comment_id") REFERENCES "public"."comments"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_issue" ON "attachments" USING btree ("project_id","issue_id","id");--> statement-breakpoint
CREATE INDEX "attachment_comment" ON "attachments" USING btree ("project_id","comment_id","id");--> statement-breakpoint
CREATE INDEX "comment_history_order" ON "comment_history" USING btree ("project_id","comment_id","revision");--> statement-breakpoint
CREATE INDEX "comment_issue_order" ON "comments" USING btree ("project_id","issue_id","created_at","id");--> statement-breakpoint
CREATE INDEX "comment_author" ON "comments" USING btree ("author_id","id");--> statement-breakpoint
CREATE INDEX "form_submission_form" ON "form_submissions" USING btree ("project_id","form_id","form_version","issue_id");--> statement-breakpoint
CREATE INDEX "identity_principal" ON "identities" USING btree ("principal_id","id");--> statement-breakpoint
CREATE INDEX "issue_assignee_filter" ON "issue_assignees" USING btree ("project_id","principal_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_form_project_enabled" ON "issue_forms" USING btree ("project_id","enabled","id");--> statement-breakpoint
CREATE INDEX "issue_label_filter" ON "issue_labels" USING btree ("project_id","label_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_template_project_enabled" ON "issue_templates" USING btree ("project_id","enabled","id");--> statement-breakpoint
CREATE INDEX "issue_type_order" ON "issue_types" USING btree ("project_id","position","id");--> statement-breakpoint
CREATE INDEX "milestone_project_state" ON "milestones" USING btree ("project_id","state","id");--> statement-breakpoint
CREATE INDEX "plugin_metadata_owner" ON "plugin_metadata" USING btree ("scope_key","owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "project_role_principal" ON "project_roles" USING btree ("principal_id","project_id");--> statement-breakpoint
CREATE INDEX "reaction_issue_group" ON "reactions" USING btree ("project_id","issue_id","reaction");--> statement-breakpoint
CREATE INDEX "reaction_comment_group" ON "reactions" USING btree ("project_id","comment_id","reaction");--> statement-breakpoint
CREATE INDEX "upload_intent_expiry" ON "upload_intents" USING btree ("state","expires_at","id");--> statement-breakpoint
CREATE INDEX "upload_intent_principal" ON "upload_intents" USING btree ("project_id","principal_id","state");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issue_type_project_fk" FOREIGN KEY ("project_id","type_id") REFERENCES "public"."issue_types"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issue_milestone_project_fk" FOREIGN KEY ("project_id","milestone_id") REFERENCES "public"."milestones"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_type_filter" ON "issues" USING btree ("project_id","type_id","created_at","id");--> statement-breakpoint
CREATE INDEX "issue_milestone_filter" ON "issues" USING btree ("project_id","milestone_id","created_at","id");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issue_moderation" CHECK ("issues"."moderation" IN ('visible','hidden','redacted'));--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issue_deleted" CHECK ("issues"."deleted_at" BETWEEN 0 AND 8640000000000000);--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issue_deleted_order" CHECK ("issues"."deleted_at" IS NULL OR "issues"."deleted_at" >= "issues"."created_at");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issue_counters_integer" CHECK (cast("issues"."revision" as bigint) = "issues"."revision" AND cast("issues"."number" as bigint) = "issues"."number");--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_counters_integer" CHECK ("outbox"."attempts" <= 2147483647 AND "outbox"."event_version" <= 2147483647 AND cast("outbox"."attempts" as bigint) = "outbox"."attempts" AND cast("outbox"."event_version" as bigint) = "outbox"."event_version");--> statement-breakpoint
ALTER TABLE "principals" ADD CONSTRAINT "principal_revision_integer" CHECK (cast("principals"."revision" as bigint) = "principals"."revision");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "project_counters_integer" CHECK (cast("projects"."revision" as bigint) = "projects"."revision" AND cast("projects"."next_issue_number" as bigint) = "projects"."next_issue_number");--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_actor" CHECK (("timeline_events"."actor_id" IS NOT NULL AND "timeline_events"."system_actor" IS NULL) OR ("timeline_events"."actor_id" IS NULL AND "timeline_events"."system_actor" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_revision_bound" CHECK ("timeline_events"."aggregate_revision" <= 2147483647 AND cast("timeline_events"."aggregate_revision" as bigint) = "timeline_events"."aggregate_revision");