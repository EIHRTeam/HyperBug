PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`close_reason` text,
	`author_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	`last_mutation_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "issue_number_bound" CHECK("__new_issues"."number" > 0 AND "__new_issues"."number" <= 2147483647),
	CONSTRAINT "issue_revision" CHECK("__new_issues"."revision" > 0 AND "__new_issues"."revision" <= 2147483647),
	CONSTRAINT "issue_title_bound" CHECK(length("__new_issues"."title") BETWEEN 1 AND 200 AND "__new_issues"."title" = trim("__new_issues"."title")),
	CONSTRAINT "issue_body_bound" CHECK(length("__new_issues"."body") <= 32768),
	CONSTRAINT "issue_state_consistency" CHECK(("__new_issues"."state" = 'open' AND "__new_issues"."close_reason" IS NULL AND "__new_issues"."closed_at" IS NULL) OR ("__new_issues"."state" = 'closed' AND "__new_issues"."close_reason" IS NOT NULL AND "__new_issues"."close_reason" IN ('completed','not_planned','duplicate','invalid','cannot_reproduce') AND "__new_issues"."closed_at" IS NOT NULL)),
	CONSTRAINT "issue_time_order" CHECK("__new_issues"."updated_at" >= "__new_issues"."created_at" AND ("__new_issues"."closed_at" IS NULL OR "__new_issues"."closed_at" >= "__new_issues"."created_at")),
	CONSTRAINT "issue_id" CHECK(length("__new_issues"."id") = 36 AND "__new_issues"."id" = lower("__new_issues"."id") AND length(replace("__new_issues"."id", '-', '')) = 32 AND replace("__new_issues"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_issues"."id",9,1) = '-' AND substr("__new_issues"."id",14,1) = '-' AND substr("__new_issues"."id",19,1) = '-' AND substr("__new_issues"."id",24,1) = '-' AND substr("__new_issues"."id",15,1) = '4' AND substr("__new_issues"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_mutation_id" CHECK(length("__new_issues"."last_mutation_id") = 36 AND "__new_issues"."last_mutation_id" = lower("__new_issues"."last_mutation_id") AND length(replace("__new_issues"."last_mutation_id", '-', '')) = 32 AND replace("__new_issues"."last_mutation_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_issues"."last_mutation_id",9,1) = '-' AND substr("__new_issues"."last_mutation_id",14,1) = '-' AND substr("__new_issues"."last_mutation_id",19,1) = '-' AND substr("__new_issues"."last_mutation_id",24,1) = '-' AND substr("__new_issues"."last_mutation_id",15,1) = '4' AND substr("__new_issues"."last_mutation_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_created" CHECK("__new_issues"."created_at" IS NULL OR (typeof("__new_issues"."created_at") = 'integer' AND "__new_issues"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "issue_updated" CHECK("__new_issues"."updated_at" IS NULL OR (typeof("__new_issues"."updated_at") = 'integer' AND "__new_issues"."updated_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "issue_closed" CHECK("__new_issues"."closed_at" IS NULL OR (typeof("__new_issues"."closed_at") = 'integer' AND "__new_issues"."closed_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_issues`("id", "project_id", "number", "title", "body", "state", "close_reason", "author_id", "revision", "created_at", "updated_at", "closed_at", "last_mutation_id") SELECT "id", "project_id", "number", "title", "body", "state", "close_reason", "author_id", "revision", "created_at", "updated_at", "closed_at", "last_mutation_id" FROM `issues`;--> statement-breakpoint
DROP TABLE `issues`;--> statement-breakpoint
ALTER TABLE `__new_issues` RENAME TO `issues`;--> statement-breakpoint
CREATE INDEX `issue_project_created` ON `issues` (`project_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `issue_project_state_created` ON `issues` (`project_id`,`state`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `issue_author` ON `issues` (`author_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_project_number` ON `issues` (`project_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_project_id` ON `issues` (`project_id`,`id`);--> statement-breakpoint
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
	CONSTRAINT "project_id" CHECK(length("__new_projects"."id") = 36 AND "__new_projects"."id" = lower("__new_projects"."id") AND length(replace("__new_projects"."id", '-', '')) = 32 AND replace("__new_projects"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_projects"."id",9,1) = '-' AND substr("__new_projects"."id",14,1) = '-' AND substr("__new_projects"."id",19,1) = '-' AND substr("__new_projects"."id",24,1) = '-' AND substr("__new_projects"."id",15,1) = '4' AND substr("__new_projects"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "project_created" CHECK("__new_projects"."created_at" IS NULL OR (typeof("__new_projects"."created_at") = 'integer' AND "__new_projects"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "project_updated" CHECK("__new_projects"."updated_at" IS NULL OR (typeof("__new_projects"."updated_at") = 'integer' AND "__new_projects"."updated_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "slug", "name", "visibility", "status", "next_issue_number", "revision", "created_at", "updated_at") SELECT "id", "slug", "name", "visibility", "status", "next_issue_number", "revision", "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`actor_id` text,
	`system_actor` text,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`result` text NOT NULL,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`metadata` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_actor" CHECK(("__new_audit_events"."actor_id" IS NOT NULL AND "__new_audit_events"."system_actor" IS NULL) OR ("__new_audit_events"."actor_id" IS NULL AND "__new_audit_events"."system_actor" IS NOT NULL)),
	CONSTRAINT "audit_result" CHECK("__new_audit_events"."result" IN ('success','failure')),
	CONSTRAINT "audit_metadata" CHECK(json_valid("__new_audit_events"."metadata") AND length("__new_audit_events"."metadata") <= 65536),
	CONSTRAINT "audit_id" CHECK(length("__new_audit_events"."id") = 36 AND "__new_audit_events"."id" = lower("__new_audit_events"."id") AND length(replace("__new_audit_events"."id", '-', '')) = 32 AND replace("__new_audit_events"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_audit_events"."id",9,1) = '-' AND substr("__new_audit_events"."id",14,1) = '-' AND substr("__new_audit_events"."id",19,1) = '-' AND substr("__new_audit_events"."id",24,1) = '-' AND substr("__new_audit_events"."id",15,1) = '4' AND substr("__new_audit_events"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "audit_request_id" CHECK(length("__new_audit_events"."request_id") = 36 AND "__new_audit_events"."request_id" = lower("__new_audit_events"."request_id") AND length(replace("__new_audit_events"."request_id", '-', '')) = 32 AND replace("__new_audit_events"."request_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_audit_events"."request_id",9,1) = '-' AND substr("__new_audit_events"."request_id",14,1) = '-' AND substr("__new_audit_events"."request_id",19,1) = '-' AND substr("__new_audit_events"."request_id",24,1) = '-' AND substr("__new_audit_events"."request_id",15,1) = '4' AND substr("__new_audit_events"."request_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "audit_created" CHECK("__new_audit_events"."created_at" IS NULL OR (typeof("__new_audit_events"."created_at") = 'integer' AND "__new_audit_events"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_audit_events`("id", "project_id", "actor_id", "system_actor", "action", "target_id", "result", "request_id", "created_at", "metadata") SELECT "id", "project_id", "actor_id", "system_actor", "action", "target_id", "result", "request_id", "created_at", "metadata" FROM `audit_events`;--> statement-breakpoint
DROP TABLE `audit_events`;--> statement-breakpoint
ALTER TABLE `__new_audit_events` RENAME TO `audit_events`;--> statement-breakpoint
CREATE INDEX `audit_project_order` ON `audit_events` (`project_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `__new_mutation_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_id` text NOT NULL,
	`project_id` text NOT NULL,
	`operation` text NOT NULL,
	`key_hash` text NOT NULL,
	`payload_hash` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "receipt_hash_length" CHECK(length("__new_mutation_receipts"."key_hash") = 64 AND length("__new_mutation_receipts"."payload_hash") = 64),
	CONSTRAINT "receipt_expiry_bound" CHECK("__new_mutation_receipts"."expires_at" > "__new_mutation_receipts"."created_at" AND "__new_mutation_receipts"."expires_at" <= "__new_mutation_receipts"."created_at" + 86400000),
	CONSTRAINT "receipt_result" CHECK(json_valid("__new_mutation_receipts"."result") AND length("__new_mutation_receipts"."result") <= 65536),
	CONSTRAINT "receipt_id" CHECK(length("__new_mutation_receipts"."id") = 36 AND "__new_mutation_receipts"."id" = lower("__new_mutation_receipts"."id") AND length(replace("__new_mutation_receipts"."id", '-', '')) = 32 AND replace("__new_mutation_receipts"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_mutation_receipts"."id",9,1) = '-' AND substr("__new_mutation_receipts"."id",14,1) = '-' AND substr("__new_mutation_receipts"."id",19,1) = '-' AND substr("__new_mutation_receipts"."id",24,1) = '-' AND substr("__new_mutation_receipts"."id",15,1) = '4' AND substr("__new_mutation_receipts"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "receipt_created" CHECK("__new_mutation_receipts"."created_at" IS NULL OR (typeof("__new_mutation_receipts"."created_at") = 'integer' AND "__new_mutation_receipts"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "receipt_expires" CHECK("__new_mutation_receipts"."expires_at" IS NULL OR (typeof("__new_mutation_receipts"."expires_at") = 'integer' AND "__new_mutation_receipts"."expires_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_mutation_receipts`("id", "principal_id", "project_id", "operation", "key_hash", "payload_hash", "result", "created_at", "expires_at") SELECT "id", "principal_id", "project_id", "operation", "key_hash", "payload_hash", "result", "created_at", "expires_at" FROM `mutation_receipts`;--> statement-breakpoint
DROP TABLE `mutation_receipts`;--> statement-breakpoint
ALTER TABLE `__new_mutation_receipts` RENAME TO `mutation_receipts`;--> statement-breakpoint
CREATE INDEX `receipt_expiry` ON `mutation_receipts` (`expires_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_scope` ON `mutation_receipts` (`principal_id`,`project_id`,`operation`,`key_hash`);--> statement-breakpoint
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
CREATE TABLE `__new_timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`issue_id` text NOT NULL,
	`aggregate_revision` integer NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	`metadata` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "timeline_revision" CHECK("__new_timeline_events"."aggregate_revision" > 0),
	CONSTRAINT "timeline_metadata" CHECK(json_valid("__new_timeline_events"."metadata") AND length("__new_timeline_events"."metadata") <= 65536),
	CONSTRAINT "timeline_id" CHECK(length("__new_timeline_events"."id") = 36 AND "__new_timeline_events"."id" = lower("__new_timeline_events"."id") AND length(replace("__new_timeline_events"."id", '-', '')) = 32 AND replace("__new_timeline_events"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("__new_timeline_events"."id",9,1) = '-' AND substr("__new_timeline_events"."id",14,1) = '-' AND substr("__new_timeline_events"."id",19,1) = '-' AND substr("__new_timeline_events"."id",24,1) = '-' AND substr("__new_timeline_events"."id",15,1) = '4' AND substr("__new_timeline_events"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "timeline_created" CHECK("__new_timeline_events"."created_at" IS NULL OR (typeof("__new_timeline_events"."created_at") = 'integer' AND "__new_timeline_events"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_timeline_events`("id", "project_id", "issue_id", "aggregate_revision", "actor_id", "action", "created_at", "metadata") SELECT "id", "project_id", "issue_id", "aggregate_revision", "actor_id", "action", "created_at", "metadata" FROM `timeline_events`;--> statement-breakpoint
DROP TABLE `timeline_events`;--> statement-breakpoint
ALTER TABLE `__new_timeline_events` RENAME TO `timeline_events`;--> statement-breakpoint
CREATE INDEX `timeline_issue_order` ON `timeline_events` (`project_id`,`issue_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `timeline_issue_revision` ON `timeline_events` (`issue_id`,`aggregate_revision`);
--> statement-breakpoint
-- Check the rebuilt graph before clearing SQLite's deferred DROP bookkeeping.
CREATE TABLE __migration_integrity_guard (violations INTEGER NOT NULL CHECK (violations = 0));
--> statement-breakpoint
INSERT INTO __migration_integrity_guard SELECT count(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
DROP TABLE __migration_integrity_guard;
--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
