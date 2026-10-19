-- Reviewed D1 rebuild: defer, verify the graph, then clear deferred DROP bookkeeping.
PRAGMA defer_foreign_keys=ON;
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`upload_intent_id` text NOT NULL,
	`issue_id` text,
	`comment_id` text,
	`object_key` text NOT NULL,
	`object_version` text NOT NULL,
	`checksum` text NOT NULL,
	`media_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`policy_state` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`project_id`,`upload_intent_id`) REFERENCES `upload_intents`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`comment_id`) REFERENCES `comments`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attachment_one_target" CHECK(("attachments"."issue_id" IS NOT NULL AND "attachments"."comment_id" IS NULL) OR ("attachments"."issue_id" IS NULL AND "attachments"."comment_id" IS NOT NULL)),
	CONSTRAINT "attachment_policy_state" CHECK("attachments"."policy_state" IN ('pending','ready','quarantined','deleted')),
	CONSTRAINT "attachment_size" CHECK("attachments"."size_bytes" BETWEEN 0 AND 9007199254740991 AND cast("attachments"."size_bytes" as bigint) = "attachments"."size_bytes"),
	CONSTRAINT "attachment_object" CHECK(length("attachments"."object_key") BETWEEN 1 AND 1024 AND length("attachments"."object_version") BETWEEN 1 AND 1024 AND length("attachments"."checksum") BETWEEN 1 AND 128 AND length("attachments"."media_type") BETWEEN 1 AND 255),
	CONSTRAINT "attachment_id" CHECK(length("attachments"."id") = 36 AND "attachments"."id" = lower("attachments"."id") AND length(replace("attachments"."id", '-', '')) = 32 AND replace("attachments"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("attachments"."id",9,1) = '-' AND substr("attachments"."id",14,1) = '-' AND substr("attachments"."id",19,1) = '-' AND substr("attachments"."id",24,1) = '-' AND substr("attachments"."id",15,1) = '4' AND substr("attachments"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "attachment_revision" CHECK("attachments"."revision" BETWEEN 1 AND 2147483647 AND cast("attachments"."revision" as integer) = "attachments"."revision"),
	CONSTRAINT "attachment_created" CHECK("attachments"."created_at" IS NULL OR (typeof("attachments"."created_at") = 'integer' AND "attachments"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_upload_intent_id_unique` ON `attachments` (`upload_intent_id`);--> statement-breakpoint
CREATE INDEX `attachment_issue` ON `attachments` (`project_id`,`issue_id`,`id`);--> statement-breakpoint
CREATE INDEX `attachment_comment` ON `attachments` (`project_id`,`comment_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attachment_project_id` ON `attachments` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `comment_history` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`revision` integer NOT NULL,
	`editor_id` text NOT NULL,
	`body` text NOT NULL,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`editor_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`comment_id`) REFERENCES `comments`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "comment_history_id" CHECK(length("comment_history"."id") = 36 AND "comment_history"."id" = lower("comment_history"."id") AND length(replace("comment_history"."id", '-', '')) = 32 AND replace("comment_history"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("comment_history"."id",9,1) = '-' AND substr("comment_history"."id",14,1) = '-' AND substr("comment_history"."id",19,1) = '-' AND substr("comment_history"."id",24,1) = '-' AND substr("comment_history"."id",15,1) = '4' AND substr("comment_history"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "comment_history_revision_bound" CHECK("comment_history"."revision" BETWEEN 1 AND 2147483647 AND cast("comment_history"."revision" as integer) = "comment_history"."revision"),
	CONSTRAINT "comment_history_changed" CHECK("comment_history"."changed_at" IS NULL OR (typeof("comment_history"."changed_at") = 'integer' AND "comment_history"."changed_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "comment_history_body" CHECK(length("comment_history"."body") <= 32768)
);
--> statement-breakpoint
CREATE INDEX `comment_history_order` ON `comment_history` (`project_id`,`comment_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `comment_history_revision` ON `comment_history` (`comment_id`,`revision`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`issue_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`moderation` text DEFAULT 'visible' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "comment_id" CHECK(length("comments"."id") = 36 AND "comments"."id" = lower("comments"."id") AND length(replace("comments"."id", '-', '')) = 32 AND replace("comments"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("comments"."id",9,1) = '-' AND substr("comments"."id",14,1) = '-' AND substr("comments"."id",19,1) = '-' AND substr("comments"."id",24,1) = '-' AND substr("comments"."id",15,1) = '4' AND substr("comments"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "comment_revision" CHECK("comments"."revision" BETWEEN 1 AND 2147483647 AND cast("comments"."revision" as integer) = "comments"."revision"),
	CONSTRAINT "comment_body" CHECK(length("comments"."body") <= 32768),
	CONSTRAINT "comment_moderation" CHECK("comments"."moderation" IN ('visible','hidden','redacted')),
	CONSTRAINT "comment_created" CHECK("comments"."created_at" IS NULL OR (typeof("comments"."created_at") = 'integer' AND "comments"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "comment_updated" CHECK("comments"."updated_at" IS NULL OR (typeof("comments"."updated_at") = 'integer' AND "comments"."updated_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "comment_deleted" CHECK("comments"."deleted_at" IS NULL OR (typeof("comments"."deleted_at") = 'integer' AND "comments"."deleted_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "comment_time_order" CHECK("comments"."updated_at" >= "comments"."created_at" AND ("comments"."deleted_at" IS NULL OR "comments"."deleted_at" >= "comments"."created_at"))
);
--> statement-breakpoint
CREATE INDEX `comment_issue_order` ON `comments` (`project_id`,`issue_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `comment_author` ON `comments` (`author_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comment_project_id` ON `comments` (`project_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comment_issue_id` ON `comments` (`project_id`,`issue_id`,`id`);--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`project_id` text NOT NULL,
	`issue_id` text NOT NULL,
	`form_id` text NOT NULL,
	`form_version` integer NOT NULL,
	`values` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `issue_id`),
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`form_id`,`form_version`) REFERENCES `issue_form_versions`(`project_id`,`form_id`,`version`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "form_submission_values" CHECK(json_valid("form_submissions"."values") AND length("form_submissions"."values") <= 65536),
	CONSTRAINT "form_submission_created" CHECK("form_submissions"."created_at" IS NULL OR (typeof("form_submissions"."created_at") = 'integer' AND "form_submissions"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE INDEX `form_submission_form` ON `form_submissions` (`project_id`,`form_id`,`form_version`,`issue_id`);--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_id` text NOT NULL,
	`provider` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "identity_id" CHECK(length("identities"."id") = 36 AND "identities"."id" = lower("identities"."id") AND length(replace("identities"."id", '-', '')) = 32 AND replace("identities"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("identities"."id",9,1) = '-' AND substr("identities"."id",14,1) = '-' AND substr("identities"."id",19,1) = '-' AND substr("identities"."id",24,1) = '-' AND substr("identities"."id",15,1) = '4' AND substr("identities"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "identity_created" CHECK("identities"."created_at" IS NULL OR (typeof("identities"."created_at") = 'integer' AND "identities"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "identity_provider_bound" CHECK(length("identities"."provider") BETWEEN 1 AND 100),
	CONSTRAINT "identity_issuer_bound" CHECK(length("identities"."issuer") BETWEEN 1 AND 1024),
	CONSTRAINT "identity_subject_bound" CHECK(length("identities"."subject") BETWEEN 1 AND 1024)
);
--> statement-breakpoint
CREATE INDEX `identity_principal` ON `identities` (`principal_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_external_subject` ON `identities` (`provider`,`issuer`,`subject`);--> statement-breakpoint
CREATE TABLE `issue_assignees` (
	`project_id` text NOT NULL,
	`issue_id` text NOT NULL,
	`principal_id` text NOT NULL,
	PRIMARY KEY(`project_id`, `issue_id`, `principal_id`),
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`principal_id`) REFERENCES `project_roles`(`project_id`,`principal_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `issue_assignee_filter` ON `issue_assignees` (`project_id`,`principal_id`,`issue_id`);--> statement-breakpoint
CREATE TABLE `issue_form_versions` (
	`project_id` text NOT NULL,
	`form_id` text NOT NULL,
	`version` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`definition` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `form_id`, `version`),
	FOREIGN KEY (`project_id`,`form_id`) REFERENCES `issue_forms`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "form_version_bound" CHECK("issue_form_versions"."version" BETWEEN 1 AND 2147483647 AND cast("issue_form_versions"."version" as integer) = "issue_form_versions"."version"),
	CONSTRAINT "form_schema_version" CHECK("issue_form_versions"."schema_version" BETWEEN 1 AND 2147483647 AND cast("issue_form_versions"."schema_version" as integer) = "issue_form_versions"."schema_version"),
	CONSTRAINT "form_definition" CHECK(json_valid("issue_form_versions"."definition") AND length("issue_form_versions"."definition") <= 65536),
	CONSTRAINT "form_version_created" CHECK("issue_form_versions"."created_at" IS NULL OR (typeof("issue_form_versions"."created_at") = 'integer' AND "issue_form_versions"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE TABLE `issue_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "issue_form_id" CHECK(length("issue_forms"."id") = 36 AND "issue_forms"."id" = lower("issue_forms"."id") AND length(replace("issue_forms"."id", '-', '')) = 32 AND replace("issue_forms"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("issue_forms"."id",9,1) = '-' AND substr("issue_forms"."id",14,1) = '-' AND substr("issue_forms"."id",19,1) = '-' AND substr("issue_forms"."id",24,1) = '-' AND substr("issue_forms"."id",15,1) = '4' AND substr("issue_forms"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_form_revision" CHECK("issue_forms"."revision" BETWEEN 1 AND 2147483647 AND cast("issue_forms"."revision" as integer) = "issue_forms"."revision"),
	CONSTRAINT "issue_form_enabled" CHECK("issue_forms"."enabled" IN (0,1)),
	CONSTRAINT "issue_form_name" CHECK(length("issue_forms"."name") BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE INDEX `issue_form_project_enabled` ON `issue_forms` (`project_id`,`enabled`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_form_project_id` ON `issue_forms` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `issue_labels` (
	`project_id` text NOT NULL,
	`issue_id` text NOT NULL,
	`label_id` text NOT NULL,
	PRIMARY KEY(`project_id`, `issue_id`, `label_id`),
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`label_id`) REFERENCES `labels`(`project_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `issue_label_filter` ON `issue_labels` (`project_id`,`label_id`,`issue_id`);--> statement-breakpoint
CREATE TABLE `issue_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "issue_template_id" CHECK(length("issue_templates"."id") = 36 AND "issue_templates"."id" = lower("issue_templates"."id") AND length(replace("issue_templates"."id", '-', '')) = 32 AND replace("issue_templates"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("issue_templates"."id",9,1) = '-' AND substr("issue_templates"."id",14,1) = '-' AND substr("issue_templates"."id",19,1) = '-' AND substr("issue_templates"."id",24,1) = '-' AND substr("issue_templates"."id",15,1) = '4' AND substr("issue_templates"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_template_revision" CHECK("issue_templates"."revision" BETWEEN 1 AND 2147483647 AND cast("issue_templates"."revision" as integer) = "issue_templates"."revision"),
	CONSTRAINT "issue_template_enabled" CHECK("issue_templates"."enabled" IN (0,1)),
	CONSTRAINT "issue_template_name" CHECK(length("issue_templates"."name") BETWEEN 1 AND 100),
	CONSTRAINT "issue_template_body" CHECK(length("issue_templates"."body") <= 32768)
);
--> statement-breakpoint
CREATE INDEX `issue_template_project_enabled` ON `issue_templates` (`project_id`,`enabled`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_template_project_id` ON `issue_templates` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `issue_types` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "issue_type_id" CHECK(length("issue_types"."id") = 36 AND "issue_types"."id" = lower("issue_types"."id") AND length(replace("issue_types"."id", '-', '')) = 32 AND replace("issue_types"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("issue_types"."id",9,1) = '-' AND substr("issue_types"."id",14,1) = '-' AND substr("issue_types"."id",19,1) = '-' AND substr("issue_types"."id",24,1) = '-' AND substr("issue_types"."id",15,1) = '4' AND substr("issue_types"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_type_revision" CHECK("issue_types"."revision" BETWEEN 1 AND 2147483647 AND cast("issue_types"."revision" as integer) = "issue_types"."revision"),
	CONSTRAINT "issue_type_name" CHECK(length("issue_types"."name") BETWEEN 1 AND 100 AND length("issue_types"."name_key") BETWEEN 1 AND 200),
	CONSTRAINT "issue_type_position" CHECK("issue_types"."position" BETWEEN 0 AND 2147483647 AND cast("issue_types"."position" as integer) = "issue_types"."position"),
	CONSTRAINT "issue_type_enabled" CHECK("issue_types"."enabled" IN (0,1)),
	CONSTRAINT "issue_type_description" CHECK(length("issue_types"."description") <= 4096),
	CONSTRAINT "issue_type_icon" CHECK(length("issue_types"."icon") <= 100),
	CONSTRAINT "issue_type_color" CHECK(length("issue_types"."color") <= 32)
);
--> statement-breakpoint
CREATE INDEX `issue_type_order` ON `issue_types` (`project_id`,`position`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_type_project_id` ON `issue_types` (`project_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_type_project_name` ON `issue_types` (`project_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "label_id" CHECK(length("labels"."id") = 36 AND "labels"."id" = lower("labels"."id") AND length(replace("labels"."id", '-', '')) = 32 AND replace("labels"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("labels"."id",9,1) = '-' AND substr("labels"."id",14,1) = '-' AND substr("labels"."id",19,1) = '-' AND substr("labels"."id",24,1) = '-' AND substr("labels"."id",15,1) = '4' AND substr("labels"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "label_revision" CHECK("labels"."revision" BETWEEN 1 AND 2147483647 AND cast("labels"."revision" as integer) = "labels"."revision"),
	CONSTRAINT "label_name" CHECK(length("labels"."name") BETWEEN 1 AND 100 AND length("labels"."name_key") BETWEEN 1 AND 200),
	CONSTRAINT "label_description" CHECK(length("labels"."description") <= 4096),
	CONSTRAINT "label_color" CHECK(length("labels"."color") <= 32)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `label_project_id` ON `labels` (`project_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `label_project_name` ON `labels` (`project_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`due_date` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "milestone_id" CHECK(length("milestones"."id") = 36 AND "milestones"."id" = lower("milestones"."id") AND length(replace("milestones"."id", '-', '')) = 32 AND replace("milestones"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("milestones"."id",9,1) = '-' AND substr("milestones"."id",14,1) = '-' AND substr("milestones"."id",19,1) = '-' AND substr("milestones"."id",24,1) = '-' AND substr("milestones"."id",15,1) = '4' AND substr("milestones"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "milestone_revision" CHECK("milestones"."revision" BETWEEN 1 AND 2147483647 AND cast("milestones"."revision" as integer) = "milestones"."revision"),
	CONSTRAINT "milestone_title" CHECK(length("milestones"."title") BETWEEN 1 AND 200),
	CONSTRAINT "milestone_description" CHECK(length("milestones"."description") <= 32768),
	CONSTRAINT "milestone_state" CHECK("milestones"."state" IN ('open','closed')),
	CONSTRAINT "milestone_date_shape" CHECK("milestones"."due_date" IS NULL OR (length("milestones"."due_date") = 10 AND substr("milestones"."due_date",5,1) = '-' AND substr("milestones"."due_date",8,1) = '-')),
	CONSTRAINT "milestone_created" CHECK("milestones"."created_at" IS NULL OR (typeof("milestones"."created_at") = 'integer' AND "milestones"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "milestone_updated" CHECK("milestones"."updated_at" IS NULL OR (typeof("milestones"."updated_at") = 'integer' AND "milestones"."updated_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "milestone_time_order" CHECK("milestones"."updated_at" >= "milestones"."created_at")
);
--> statement-breakpoint
CREATE INDEX `milestone_project_state` ON `milestones` (`project_id`,`state`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `milestone_project_id` ON `milestones` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `plugin_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`scope_key` text NOT NULL,
	`plugin_id` text NOT NULL,
	`plugin_version` text NOT NULL,
	`manifest_version` integer NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "plugin_installation_scope" CHECK("plugin_installations"."scope_key" = coalesce(cast("plugin_installations"."project_id" as text), 'deployment')),
	CONSTRAINT "plugin_installation_names" CHECK(length("plugin_installations"."plugin_id") BETWEEN 1 AND 100 AND length("plugin_installations"."plugin_version") BETWEEN 1 AND 100),
	CONSTRAINT "plugin_installation_id" CHECK(length("plugin_installations"."id") = 36 AND "plugin_installations"."id" = lower("plugin_installations"."id") AND length(replace("plugin_installations"."id", '-', '')) = 32 AND replace("plugin_installations"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("plugin_installations"."id",9,1) = '-' AND substr("plugin_installations"."id",14,1) = '-' AND substr("plugin_installations"."id",19,1) = '-' AND substr("plugin_installations"."id",24,1) = '-' AND substr("plugin_installations"."id",15,1) = '4' AND substr("plugin_installations"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "plugin_installation_enabled" CHECK("plugin_installations"."enabled" IN (0,1)),
	CONSTRAINT "plugin_installation_revision" CHECK("plugin_installations"."revision" BETWEEN 1 AND 2147483647 AND cast("plugin_installations"."revision" as integer) = "plugin_installations"."revision"),
	CONSTRAINT "plugin_manifest_version" CHECK("plugin_installations"."manifest_version" BETWEEN 1 AND 2147483647 AND cast("plugin_installations"."manifest_version" as integer) = "plugin_installations"."manifest_version"),
	CONSTRAINT "plugin_installation_created" CHECK("plugin_installations"."created_at" IS NULL OR (typeof("plugin_installations"."created_at") = 'integer' AND "plugin_installations"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_installation_scope_id` ON `plugin_installations` (`scope_key`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_installation_scope_plugin` ON `plugin_installations` (`scope_key`,`plugin_id`);--> statement-breakpoint
CREATE TABLE `plugin_metadata` (
	`installation_id` text NOT NULL,
	`scope_key` text NOT NULL,
	`namespace` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`schema_version` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`installation_id`, `namespace`, `owner_type`, `owner_id`, `key`),
	FOREIGN KEY (`scope_key`,`installation_id`) REFERENCES `plugin_installations`(`scope_key`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "plugin_metadata_names" CHECK(length("plugin_metadata"."namespace") BETWEEN 1 AND 100 AND length("plugin_metadata"."owner_type") BETWEEN 1 AND 100 AND length("plugin_metadata"."key") BETWEEN 1 AND 100),
	CONSTRAINT "plugin_metadata_owner_id" CHECK(length("plugin_metadata"."owner_id") = 36 AND "plugin_metadata"."owner_id" = lower("plugin_metadata"."owner_id") AND length(replace("plugin_metadata"."owner_id", '-', '')) = 32 AND replace("plugin_metadata"."owner_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("plugin_metadata"."owner_id",9,1) = '-' AND substr("plugin_metadata"."owner_id",14,1) = '-' AND substr("plugin_metadata"."owner_id",19,1) = '-' AND substr("plugin_metadata"."owner_id",24,1) = '-' AND substr("plugin_metadata"."owner_id",15,1) = '4' AND substr("plugin_metadata"."owner_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "plugin_metadata_schema_version" CHECK("plugin_metadata"."schema_version" BETWEEN 1 AND 2147483647 AND cast("plugin_metadata"."schema_version" as integer) = "plugin_metadata"."schema_version"),
	CONSTRAINT "plugin_metadata_revision" CHECK("plugin_metadata"."revision" BETWEEN 1 AND 2147483647 AND cast("plugin_metadata"."revision" as integer) = "plugin_metadata"."revision"),
	CONSTRAINT "plugin_metadata_value" CHECK(json_valid("plugin_metadata"."value") AND length("plugin_metadata"."value") <= 65536)
);
--> statement-breakpoint
CREATE INDEX `plugin_metadata_owner` ON `plugin_metadata` (`scope_key`,`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `project_roles` (
	`project_id` text NOT NULL,
	`principal_id` text NOT NULL,
	`principal_kind` text DEFAULT 'staff' NOT NULL,
	`role` text NOT NULL,
	`granted_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`project_id`, `principal_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`principal_id`,`principal_kind`) REFERENCES `principals`(`id`,`kind`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_role_staff" CHECK("project_roles"."principal_kind" = 'staff'),
	CONSTRAINT "project_role_name" CHECK("project_roles"."role" IN ('triage','maintainer','administrator')),
	CONSTRAINT "project_role_granted" CHECK("project_roles"."granted_at" IS NULL OR (typeof("project_roles"."granted_at") = 'integer' AND "project_roles"."granted_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "project_role_revision" CHECK("project_roles"."revision" BETWEEN 1 AND 2147483647 AND cast("project_roles"."revision" as integer) = "project_roles"."revision")
);
--> statement-breakpoint
CREATE INDEX `project_role_principal` ON `project_roles` (`principal_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`issue_id` text,
	`comment_id` text,
	`principal_id` text NOT NULL,
	`reaction` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`comment_id`) REFERENCES `comments`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reaction_one_target" CHECK(("reactions"."issue_id" IS NOT NULL AND "reactions"."comment_id" IS NULL) OR ("reactions"."issue_id" IS NULL AND "reactions"."comment_id" IS NOT NULL)),
	CONSTRAINT "reaction_allowlist" CHECK("reactions"."reaction" IN ('thumbs_up','thumbs_down','laugh','hooray','confused','heart','rocket','eyes')),
	CONSTRAINT "reaction_id" CHECK(length("reactions"."id") = 36 AND "reactions"."id" = lower("reactions"."id") AND length(replace("reactions"."id", '-', '')) = 32 AND replace("reactions"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("reactions"."id",9,1) = '-' AND substr("reactions"."id",14,1) = '-' AND substr("reactions"."id",19,1) = '-' AND substr("reactions"."id",24,1) = '-' AND substr("reactions"."id",15,1) = '4' AND substr("reactions"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "reaction_created" CHECK("reactions"."created_at" IS NULL OR (typeof("reactions"."created_at") = 'integer' AND "reactions"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE INDEX `reaction_issue_group` ON `reactions` (`project_id`,`issue_id`,`reaction`);--> statement-breakpoint
CREATE INDEX `reaction_comment_group` ON `reactions` (`project_id`,`comment_id`,`reaction`);--> statement-breakpoint
CREATE UNIQUE INDEX `reaction_issue_actor` ON `reactions` (`issue_id`,`principal_id`,`reaction`);--> statement-breakpoint
CREATE UNIQUE INDEX `reaction_comment_actor` ON `reactions` (`comment_id`,`principal_id`,`reaction`);--> statement-breakpoint
CREATE TABLE `upload_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`principal_id` text NOT NULL,
	`object_key` text NOT NULL,
	`media_type` text NOT NULL,
	`max_bytes` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_object_version` text,
	`verified_checksum` text,
	`actual_bytes` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "upload_intent_id" CHECK(length("upload_intents"."id") = 36 AND "upload_intents"."id" = lower("upload_intents"."id") AND length(replace("upload_intents"."id", '-', '')) = 32 AND replace("upload_intents"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("upload_intents"."id",9,1) = '-' AND substr("upload_intents"."id",14,1) = '-' AND substr("upload_intents"."id",19,1) = '-' AND substr("upload_intents"."id",24,1) = '-' AND substr("upload_intents"."id",15,1) = '4' AND substr("upload_intents"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "upload_intent_revision" CHECK("upload_intents"."revision" BETWEEN 1 AND 2147483647 AND cast("upload_intents"."revision" as integer) = "upload_intents"."revision"),
	CONSTRAINT "upload_intent_created" CHECK("upload_intents"."created_at" IS NULL OR (typeof("upload_intents"."created_at") = 'integer' AND "upload_intents"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "upload_intent_expires" CHECK("upload_intents"."expires_at" IS NULL OR (typeof("upload_intents"."expires_at") = 'integer' AND "upload_intents"."expires_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "upload_intent_expiry_bound" CHECK("upload_intents"."expires_at" > "upload_intents"."created_at"),
	CONSTRAINT "upload_intent_size" CHECK("upload_intents"."max_bytes" BETWEEN 1 AND 9007199254740991 AND cast("upload_intents"."max_bytes" as bigint) = "upload_intents"."max_bytes" AND ("upload_intents"."actual_bytes" IS NULL OR ("upload_intents"."actual_bytes" BETWEEN 0 AND "upload_intents"."max_bytes" AND cast("upload_intents"."actual_bytes" as bigint) = "upload_intents"."actual_bytes"))),
	CONSTRAINT "upload_intent_state" CHECK("upload_intents"."state" IN ('pending','uploaded','finalized','expired','rejected')),
	CONSTRAINT "upload_intent_finalized" CHECK("upload_intents"."state" != 'finalized' OR ("upload_intents"."verified_object_version" IS NOT NULL AND "upload_intents"."verified_checksum" IS NOT NULL AND "upload_intents"."actual_bytes" IS NOT NULL)),
	CONSTRAINT "upload_intent_key" CHECK(length("upload_intents"."object_key") BETWEEN 1 AND 1024),
	CONSTRAINT "upload_intent_media_type" CHECK(length("upload_intents"."media_type") BETWEEN 1 AND 255),
	CONSTRAINT "upload_intent_version_bound" CHECK(length("upload_intents"."verified_object_version") <= 1024),
	CONSTRAINT "upload_intent_checksum_bound" CHECK(length("upload_intents"."verified_checksum") <= 128)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_intents_object_key_unique` ON `upload_intents` (`object_key`);--> statement-breakpoint
CREATE INDEX `upload_intent_expiry` ON `upload_intents` (`state`,`expires_at`,`id`);--> statement-breakpoint
CREATE INDEX `upload_intent_principal` ON `upload_intents` (`project_id`,`principal_id`,`state`);--> statement-breakpoint
CREATE UNIQUE INDEX `upload_intent_project_id` ON `upload_intents` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`issue_id` text NOT NULL,
	`aggregate_revision` integer NOT NULL,
	`actor_id` text,
	`system_actor` text,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	`metadata` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "timeline_actor" CHECK(("__new_timeline_events"."actor_id" IS NOT NULL AND "__new_timeline_events"."system_actor" IS NULL) OR ("__new_timeline_events"."actor_id" IS NULL AND "__new_timeline_events"."system_actor" IS NOT NULL)),
	CONSTRAINT "timeline_revision" CHECK("__new_timeline_events"."aggregate_revision" > 0),
	CONSTRAINT "timeline_metadata" CHECK(json_valid("__new_timeline_events"."metadata") AND length("__new_timeline_events"."metadata") <= 65536),
	CONSTRAINT "timeline_revision_bound" CHECK("__new_timeline_events"."aggregate_revision" <= 2147483647 AND cast("__new_timeline_events"."aggregate_revision" as bigint) = "__new_timeline_events"."aggregate_revision"),
	CONSTRAINT "timeline_id" CHECK(length("__new_timeline_events"."id") = 36 AND "__new_timeline_events"."id" = lower("__new_timeline_events"."id") AND length(replace("__new_timeline_events"."id", '-', '')) = 32 AND replace("__new_timeline_events"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_timeline_events"."id",9,1) = '-' AND substr("__new_timeline_events"."id",14,1) = '-' AND substr("__new_timeline_events"."id",19,1) = '-' AND substr("__new_timeline_events"."id",24,1) = '-' AND substr("__new_timeline_events"."id",15,1) = '4' AND substr("__new_timeline_events"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "timeline_created" CHECK("__new_timeline_events"."created_at" IS NULL OR (typeof("__new_timeline_events"."created_at") = 'integer' AND "__new_timeline_events"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_timeline_events`("id", "project_id", "issue_id", "aggregate_revision", "actor_id", "system_actor", "action", "created_at", "metadata") SELECT "id", "project_id", "issue_id", "aggregate_revision", "actor_id", NULL, "action", "created_at", "metadata" FROM `timeline_events`;--> statement-breakpoint
DROP TABLE `timeline_events`;--> statement-breakpoint
ALTER TABLE `__new_timeline_events` RENAME TO `timeline_events`;--> statement-breakpoint
CREATE INDEX `timeline_issue_order` ON `timeline_events` (`project_id`,`issue_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `timeline_issue_revision` ON `timeline_events` (`issue_id`,`aggregate_revision`);--> statement-breakpoint
CREATE TABLE `__new_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`close_reason` text,
	`type_id` text,
	`milestone_id` text,
	`moderation` text DEFAULT 'visible' NOT NULL,
	`deleted_at` integer,
	`author_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	`last_mutation_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`type_id`) REFERENCES `issue_types`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`milestone_id`) REFERENCES `milestones`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "issue_moderation" CHECK("__new_issues"."moderation" IN ('visible','hidden','redacted')),
	CONSTRAINT "issue_deleted" CHECK("__new_issues"."deleted_at" IS NULL OR (typeof("__new_issues"."deleted_at") = 'integer' AND "__new_issues"."deleted_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "issue_deleted_order" CHECK("__new_issues"."deleted_at" IS NULL OR "__new_issues"."deleted_at" >= "__new_issues"."created_at"),
	CONSTRAINT "issue_number_bound" CHECK("__new_issues"."number" > 0 AND "__new_issues"."number" <= 2147483647),
	CONSTRAINT "issue_revision" CHECK("__new_issues"."revision" > 0 AND "__new_issues"."revision" <= 2147483647),
	CONSTRAINT "issue_title_bound" CHECK(length("__new_issues"."title") BETWEEN 1 AND 200 AND "__new_issues"."title" = trim("__new_issues"."title")),
	CONSTRAINT "issue_body_bound" CHECK(length("__new_issues"."body") <= 32768),
	CONSTRAINT "issue_state_consistency" CHECK(("__new_issues"."state" = 'open' AND "__new_issues"."close_reason" IS NULL AND "__new_issues"."closed_at" IS NULL) OR ("__new_issues"."state" = 'closed' AND "__new_issues"."close_reason" IS NOT NULL AND "__new_issues"."close_reason" IN ('completed','not_planned','duplicate','invalid','cannot_reproduce') AND "__new_issues"."closed_at" IS NOT NULL)),
	CONSTRAINT "issue_time_order" CHECK("__new_issues"."updated_at" >= "__new_issues"."created_at" AND ("__new_issues"."closed_at" IS NULL OR "__new_issues"."closed_at" >= "__new_issues"."created_at")),
	CONSTRAINT "issue_counters_integer" CHECK(cast("__new_issues"."revision" as bigint) = "__new_issues"."revision" AND cast("__new_issues"."number" as bigint) = "__new_issues"."number"),
	CONSTRAINT "issue_id" CHECK(length("__new_issues"."id") = 36 AND "__new_issues"."id" = lower("__new_issues"."id") AND length(replace("__new_issues"."id", '-', '')) = 32 AND replace("__new_issues"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_issues"."id",9,1) = '-' AND substr("__new_issues"."id",14,1) = '-' AND substr("__new_issues"."id",19,1) = '-' AND substr("__new_issues"."id",24,1) = '-' AND substr("__new_issues"."id",15,1) = '4' AND substr("__new_issues"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_mutation_id" CHECK(length("__new_issues"."last_mutation_id") = 36 AND "__new_issues"."last_mutation_id" = lower("__new_issues"."last_mutation_id") AND length(replace("__new_issues"."last_mutation_id", '-', '')) = 32 AND replace("__new_issues"."last_mutation_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_issues"."last_mutation_id",9,1) = '-' AND substr("__new_issues"."last_mutation_id",14,1) = '-' AND substr("__new_issues"."last_mutation_id",19,1) = '-' AND substr("__new_issues"."last_mutation_id",24,1) = '-' AND substr("__new_issues"."last_mutation_id",15,1) = '4' AND substr("__new_issues"."last_mutation_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_created" CHECK("__new_issues"."created_at" IS NULL OR (typeof("__new_issues"."created_at") = 'integer' AND "__new_issues"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "issue_updated" CHECK("__new_issues"."updated_at" IS NULL OR (typeof("__new_issues"."updated_at") = 'integer' AND "__new_issues"."updated_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "issue_closed" CHECK("__new_issues"."closed_at" IS NULL OR (typeof("__new_issues"."closed_at") = 'integer' AND "__new_issues"."closed_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_issues`("id", "project_id", "number", "title", "body", "state", "close_reason", "type_id", "milestone_id", "moderation", "deleted_at", "author_id", "revision", "created_at", "updated_at", "closed_at", "last_mutation_id") SELECT "id", "project_id", "number", "title", "body", "state", "close_reason", NULL, NULL, 'visible', NULL, "author_id", "revision", "created_at", "updated_at", "closed_at", "last_mutation_id" FROM `issues`;--> statement-breakpoint
DROP TABLE `issues`;--> statement-breakpoint
ALTER TABLE `__new_issues` RENAME TO `issues`;--> statement-breakpoint
CREATE INDEX `issue_project_created` ON `issues` (`project_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `issue_project_state_created` ON `issues` (`project_id`,`state`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `issue_author` ON `issues` (`author_id`,`id`);--> statement-breakpoint
CREATE INDEX `issue_type_filter` ON `issues` (`project_id`,`type_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `issue_milestone_filter` ON `issues` (`project_id`,`milestone_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_project_number` ON `issues` (`project_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_project_id` ON `issues` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_version` integer DEFAULT 1 NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`available_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`delivered_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "outbox_attempts" CHECK("__new_outbox"."attempts" >= 0),
	CONSTRAINT "outbox_version" CHECK("__new_outbox"."event_version" > 0),
	CONSTRAINT "outbox_payload" CHECK(json_valid("__new_outbox"."payload") AND length("__new_outbox"."payload") <= 65536),
	CONSTRAINT "outbox_counters_integer" CHECK("__new_outbox"."attempts" <= 2147483647 AND "__new_outbox"."event_version" <= 2147483647 AND cast("__new_outbox"."attempts" as bigint) = "__new_outbox"."attempts" AND cast("__new_outbox"."event_version" as bigint) = "__new_outbox"."event_version"),
	CONSTRAINT "outbox_id" CHECK(length("__new_outbox"."id") = 36 AND "__new_outbox"."id" = lower("__new_outbox"."id") AND length(replace("__new_outbox"."id", '-', '')) = 32 AND replace("__new_outbox"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_outbox"."id",9,1) = '-' AND substr("__new_outbox"."id",14,1) = '-' AND substr("__new_outbox"."id",19,1) = '-' AND substr("__new_outbox"."id",24,1) = '-' AND substr("__new_outbox"."id",15,1) = '4' AND substr("__new_outbox"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "outbox_aggregate_id" CHECK(length("__new_outbox"."aggregate_id") = 36 AND "__new_outbox"."aggregate_id" = lower("__new_outbox"."aggregate_id") AND length(replace("__new_outbox"."aggregate_id", '-', '')) = 32 AND replace("__new_outbox"."aggregate_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_outbox"."aggregate_id",9,1) = '-' AND substr("__new_outbox"."aggregate_id",14,1) = '-' AND substr("__new_outbox"."aggregate_id",19,1) = '-' AND substr("__new_outbox"."aggregate_id",24,1) = '-' AND substr("__new_outbox"."aggregate_id",15,1) = '4' AND substr("__new_outbox"."aggregate_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "outbox_created" CHECK("__new_outbox"."created_at" IS NULL OR (typeof("__new_outbox"."created_at") = 'integer' AND "__new_outbox"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "outbox_available" CHECK("__new_outbox"."available_at" IS NULL OR (typeof("__new_outbox"."available_at") = 'integer' AND "__new_outbox"."available_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "outbox_delivered" CHECK("__new_outbox"."delivered_at" IS NULL OR (typeof("__new_outbox"."delivered_at") = 'integer' AND "__new_outbox"."delivered_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_outbox`("id", "project_id", "aggregate_id", "event_type", "event_version", "payload", "created_at", "available_at", "attempts", "delivered_at") SELECT "id", "project_id", "aggregate_id", "event_type", "event_version", "payload", "created_at", "available_at", "attempts", "delivered_at" FROM `outbox`;--> statement-breakpoint
DROP TABLE `outbox`;--> statement-breakpoint
ALTER TABLE `__new_outbox` RENAME TO `outbox`;--> statement-breakpoint
CREATE INDEX `outbox_pending` ON `outbox` (`delivered_at`,`available_at`,`id`);--> statement-breakpoint
CREATE TABLE `__new_principals` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "principal_kind" CHECK("__new_principals"."kind" IN ('user','staff')),
	CONSTRAINT "principal_status" CHECK("__new_principals"."status" IN ('active','suspended','deleted')),
	CONSTRAINT "principal_revision" CHECK("__new_principals"."revision" > 0 AND "__new_principals"."revision" <= 2147483647),
	CONSTRAINT "principal_revision_integer" CHECK(cast("__new_principals"."revision" as bigint) = "__new_principals"."revision"),
	CONSTRAINT "principal_id" CHECK(length("__new_principals"."id") = 36 AND "__new_principals"."id" = lower("__new_principals"."id") AND length(replace("__new_principals"."id", '-', '')) = 32 AND replace("__new_principals"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_principals"."id",9,1) = '-' AND substr("__new_principals"."id",14,1) = '-' AND substr("__new_principals"."id",19,1) = '-' AND substr("__new_principals"."id",24,1) = '-' AND substr("__new_principals"."id",15,1) = '4' AND substr("__new_principals"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "principal_created" CHECK("__new_principals"."created_at" IS NULL OR (typeof("__new_principals"."created_at") = 'integer' AND "__new_principals"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_principals`("id", "kind", "display_name", "status", "created_at", "revision") SELECT "id", "kind", "display_name", "status", "created_at", "revision" FROM `principals`;--> statement-breakpoint
DROP TABLE `principals`;--> statement-breakpoint
ALTER TABLE `__new_principals` RENAME TO `principals`;--> statement-breakpoint
CREATE UNIQUE INDEX `principal_identity_kind` ON `principals` (`id`,`kind`);--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`next_issue_number` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "project_visibility" CHECK("__new_projects"."visibility" IN ('public','private')),
	CONSTRAINT "project_status" CHECK("__new_projects"."status" IN ('active','archived')),
	CONSTRAINT "project_number_bound" CHECK("__new_projects"."next_issue_number" >= 1 AND "__new_projects"."next_issue_number" <= 2147483647),
	CONSTRAINT "project_revision" CHECK("__new_projects"."revision" > 0 AND "__new_projects"."revision" <= 2147483647),
	CONSTRAINT "project_slug" CHECK(length("__new_projects"."slug") BETWEEN 1 AND 63 AND "__new_projects"."slug" = lower("__new_projects"."slug")),
	CONSTRAINT "project_time_order" CHECK("__new_projects"."updated_at" >= "__new_projects"."created_at"),
	CONSTRAINT "project_counters_integer" CHECK(cast("__new_projects"."revision" as bigint) = "__new_projects"."revision" AND cast("__new_projects"."next_issue_number" as bigint) = "__new_projects"."next_issue_number"),
	CONSTRAINT "project_id" CHECK(length("__new_projects"."id") = 36 AND "__new_projects"."id" = lower("__new_projects"."id") AND length(replace("__new_projects"."id", '-', '')) = 32 AND replace("__new_projects"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_projects"."id",9,1) = '-' AND substr("__new_projects"."id",14,1) = '-' AND substr("__new_projects"."id",19,1) = '-' AND substr("__new_projects"."id",24,1) = '-' AND substr("__new_projects"."id",15,1) = '4' AND substr("__new_projects"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "project_created" CHECK("__new_projects"."created_at" IS NULL OR (typeof("__new_projects"."created_at") = 'integer' AND "__new_projects"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "project_updated" CHECK("__new_projects"."updated_at" IS NULL OR (typeof("__new_projects"."updated_at") = 'integer' AND "__new_projects"."updated_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "slug", "name", "visibility", "status", "next_issue_number", "revision", "created_at", "updated_at") SELECT "id", "slug", "name", "visibility", "status", "next_issue_number", "revision", "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);
--> statement-breakpoint
CREATE TABLE __migration_integrity_guard (violations INTEGER NOT NULL CHECK (violations = 0));
--> statement-breakpoint
INSERT INTO __migration_integrity_guard SELECT count(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
DROP TABLE __migration_integrity_guard;
--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
--> statement-breakpoint
CREATE TRIGGER timeline_events_no_update BEFORE UPDATE ON timeline_events BEGIN SELECT RAISE(ABORT, 'timeline_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER timeline_events_no_delete BEFORE DELETE ON timeline_events BEGIN SELECT RAISE(ABORT, 'timeline_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER timeline_events_no_replace BEFORE INSERT ON timeline_events WHEN EXISTS (SELECT 1 FROM timeline_events WHERE id = NEW.id OR (issue_id = NEW.issue_id AND aggregate_revision = NEW.aggregate_revision)) BEGIN SELECT RAISE(ABORT, 'timeline_events is append-only'); END;
