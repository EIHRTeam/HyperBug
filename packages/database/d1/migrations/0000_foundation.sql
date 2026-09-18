CREATE TABLE `audit_events` (
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
	CONSTRAINT "audit_actor" CHECK(("audit_events"."actor_id" IS NOT NULL AND "audit_events"."system_actor" IS NULL) OR ("audit_events"."actor_id" IS NULL AND "audit_events"."system_actor" IS NOT NULL)),
	CONSTRAINT "audit_result" CHECK("audit_events"."result" IN ('success','failure')),
	CONSTRAINT "audit_metadata" CHECK(json_valid("audit_events"."metadata") AND length("audit_events"."metadata") <= 65536)
);
--> statement-breakpoint
CREATE INDEX `audit_project_order` ON `audit_events` (`project_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `issues` (
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
	CONSTRAINT "issue_number_bound" CHECK("issues"."number" > 0 AND "issues"."number" <= 2147483647),
	CONSTRAINT "issue_revision" CHECK("issues"."revision" > 0 AND "issues"."revision" <= 2147483647),
	CONSTRAINT "issue_title_bound" CHECK(length("issues"."title") BETWEEN 1 AND 200 AND "issues"."title" = trim("issues"."title")),
	CONSTRAINT "issue_body_bound" CHECK(length("issues"."body") <= 32768),
	CONSTRAINT "issue_state_consistency" CHECK(("issues"."state" = 'open' AND "issues"."close_reason" IS NULL AND "issues"."closed_at" IS NULL) OR ("issues"."state" = 'closed' AND "issues"."close_reason" IN ('completed','not_planned','duplicate','invalid','cannot_reproduce') AND "issues"."closed_at" IS NOT NULL)),
	CONSTRAINT "issue_time_order" CHECK("issues"."updated_at" >= "issues"."created_at" AND ("issues"."closed_at" IS NULL OR "issues"."closed_at" >= "issues"."created_at")),
	CONSTRAINT "issue_id" CHECK(length("issues"."id") = 36 AND "issues"."id" = lower("issues"."id") AND "issues"."id" NOT GLOB '*[^0-9a-f-]*' AND substr("issues"."id",9,1) = '-' AND substr("issues"."id",14,1) = '-' AND substr("issues"."id",19,1) = '-' AND substr("issues"."id",24,1) = '-' AND substr("issues"."id",15,1) = '4' AND substr("issues"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_mutation_id" CHECK(length("issues"."last_mutation_id") = 36 AND "issues"."last_mutation_id" = lower("issues"."last_mutation_id") AND "issues"."last_mutation_id" NOT GLOB '*[^0-9a-f-]*' AND substr("issues"."last_mutation_id",9,1) = '-' AND substr("issues"."last_mutation_id",14,1) = '-' AND substr("issues"."last_mutation_id",19,1) = '-' AND substr("issues"."last_mutation_id",24,1) = '-' AND substr("issues"."last_mutation_id",15,1) = '4' AND substr("issues"."last_mutation_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "issue_created" CHECK(typeof("issues"."created_at") = 'integer' AND "issues"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "issue_updated" CHECK(typeof("issues"."updated_at") = 'integer' AND "issues"."updated_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE INDEX `issue_project_created` ON `issues` (`project_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `issue_project_state_created` ON `issues` (`project_id`,`state`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `issue_author` ON `issues` (`author_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_project_number` ON `issues` (`project_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_project_id` ON `issues` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `mutation_receipts` (
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
	CONSTRAINT "receipt_hash_length" CHECK(length("mutation_receipts"."key_hash") = 64 AND length("mutation_receipts"."payload_hash") = 64),
	CONSTRAINT "receipt_expiry_bound" CHECK("mutation_receipts"."expires_at" > "mutation_receipts"."created_at" AND "mutation_receipts"."expires_at" <= "mutation_receipts"."created_at" + 86400000),
	CONSTRAINT "receipt_result" CHECK(json_valid("mutation_receipts"."result") AND length("mutation_receipts"."result") <= 65536)
);
--> statement-breakpoint
CREATE INDEX `receipt_expiry` ON `mutation_receipts` (`expires_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_scope` ON `mutation_receipts` (`principal_id`,`project_id`,`operation`,`key_hash`);--> statement-breakpoint
CREATE TABLE `outbox` (
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
	CONSTRAINT "outbox_attempts" CHECK("outbox"."attempts" >= 0),
	CONSTRAINT "outbox_version" CHECK("outbox"."event_version" > 0),
	CONSTRAINT "outbox_payload" CHECK(json_valid("outbox"."payload") AND length("outbox"."payload") <= 65536)
);
--> statement-breakpoint
CREATE INDEX `outbox_pending` ON `outbox` (`delivered_at`,`available_at`,`id`);--> statement-breakpoint
CREATE TABLE `principals` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "principal_kind" CHECK("principals"."kind" IN ('user','staff')),
	CONSTRAINT "principal_status" CHECK("principals"."status" IN ('active','suspended','deleted')),
	CONSTRAINT "principal_revision" CHECK("principals"."revision" > 0 AND "principals"."revision" <= 2147483647),
	CONSTRAINT "principal_id" CHECK(length("principals"."id") = 36 AND "principals"."id" = lower("principals"."id") AND "principals"."id" NOT GLOB '*[^0-9a-f-]*' AND substr("principals"."id",9,1) = '-' AND substr("principals"."id",14,1) = '-' AND substr("principals"."id",19,1) = '-' AND substr("principals"."id",24,1) = '-' AND substr("principals"."id",15,1) = '4' AND substr("principals"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "principal_created" CHECK(typeof("principals"."created_at") = 'integer' AND "principals"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `principal_identity_kind` ON `principals` (`id`,`kind`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`next_issue_number` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "project_visibility" CHECK("projects"."visibility" IN ('public','private')),
	CONSTRAINT "project_status" CHECK("projects"."status" IN ('active','archived')),
	CONSTRAINT "project_number_bound" CHECK("projects"."next_issue_number" >= 1 AND "projects"."next_issue_number" <= 2147483647),
	CONSTRAINT "project_revision" CHECK("projects"."revision" > 0 AND "projects"."revision" <= 2147483647),
	CONSTRAINT "project_slug" CHECK(length("projects"."slug") BETWEEN 1 AND 63 AND "projects"."slug" = lower("projects"."slug")),
	CONSTRAINT "project_time_order" CHECK("projects"."updated_at" >= "projects"."created_at"),
	CONSTRAINT "project_id" CHECK(length("projects"."id") = 36 AND "projects"."id" = lower("projects"."id") AND "projects"."id" NOT GLOB '*[^0-9a-f-]*' AND substr("projects"."id",9,1) = '-' AND substr("projects"."id",14,1) = '-' AND substr("projects"."id",19,1) = '-' AND substr("projects"."id",24,1) = '-' AND substr("projects"."id",15,1) = '4' AND substr("projects"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "project_created" CHECK(typeof("projects"."created_at") = 'integer' AND "projects"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "project_updated" CHECK(typeof("projects"."updated_at") = 'integer' AND "projects"."updated_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `timeline_events` (
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
	CONSTRAINT "timeline_revision" CHECK("timeline_events"."aggregate_revision" > 0),
	CONSTRAINT "timeline_metadata" CHECK(json_valid("timeline_events"."metadata") AND length("timeline_events"."metadata") <= 65536)
);
--> statement-breakpoint
CREATE INDEX `timeline_issue_order` ON `timeline_events` (`project_id`,`issue_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `timeline_issue_revision` ON `timeline_events` (`issue_id`,`aggregate_revision`);