CREATE TABLE `async_deliveries` (
	`delivery_id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`event_id` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`publication_attempts` integer DEFAULT 0 NOT NULL,
	`available_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`publish_token` text,
	`publish_until` integer DEFAULT 0 NOT NULL,
	`work_token` text,
	`work_until` integer DEFAULT 0 NOT NULL,
	`failure` text,
	CONSTRAINT "async_source" CHECK("async_deliveries"."source" IN ('core','plugin')),
	CONSTRAINT "async_state" CHECK("async_deliveries"."state" IN ('pending','done','failed')),
	CONSTRAINT "async_attempts" CHECK("async_deliveries"."attempts" BETWEEN 0 AND 5 AND "async_deliveries"."publication_attempts" BETWEEN 0 AND 5),
	CONSTRAINT "async_failure" CHECK("async_deliveries"."failure" IS NULL OR "async_deliveries"."failure" IN ('invalid','unsupported','permanent','transient','timeout','lease-exhausted')),
	CONSTRAINT "async_event_id" CHECK(length("async_deliveries"."event_id") = 36 AND "async_deliveries"."event_id" = lower("async_deliveries"."event_id") AND length(replace("async_deliveries"."event_id", '-', '')) = 32 AND replace("async_deliveries"."event_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("async_deliveries"."event_id",9,1) = '-' AND substr("async_deliveries"."event_id",14,1) = '-' AND substr("async_deliveries"."event_id",19,1) = '-' AND substr("async_deliveries"."event_id",24,1) = '-' AND substr("async_deliveries"."event_id",15,1) = '4' AND substr("async_deliveries"."event_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "async_created" CHECK("async_deliveries"."created_at" IS NULL OR (typeof("async_deliveries"."created_at") = 'integer' AND "async_deliveries"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "async_available" CHECK("async_deliveries"."available_at" IS NULL OR (typeof("async_deliveries"."available_at") = 'integer' AND "async_deliveries"."available_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "async_updated" CHECK("async_deliveries"."updated_at" IS NULL OR (typeof("async_deliveries"."updated_at") = 'integer' AND "async_deliveries"."updated_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE INDEX `async_pending` ON `async_deliveries` (`state`,`available_at`,`delivery_id`);--> statement-breakpoint
CREATE INDEX `async_terminal` ON `async_deliveries` (`state`,`updated_at`,`delivery_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `async_source_event` ON `async_deliveries` (`source`,`event_id`);--> statement-breakpoint
CREATE TABLE `async_job_steps` (
	`job_id` text NOT NULL,
	`step` integer NOT NULL,
	`committed_at` integer NOT NULL,
	PRIMARY KEY(`job_id`, `step`),
	FOREIGN KEY (`job_id`) REFERENCES `async_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "async_step_bound" CHECK("async_job_steps"."step" BETWEEN 0 AND 15),
	CONSTRAINT "async_step_time" CHECK("async_job_steps"."committed_at" IS NULL OR (typeof("async_job_steps"."committed_at") = 'integer' AND "async_job_steps"."committed_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE TABLE `async_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'conformance' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`checkpoint` integer DEFAULT 0 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_steps` integer NOT NULL,
	`result_reference` text,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "async_job_status" CHECK("async_jobs"."status" IN ('pending','running','completed','failed','cancelled')),
	CONSTRAINT "async_job_kind" CHECK("async_jobs"."kind" = 'conformance'),
	CONSTRAINT "async_job_bounds" CHECK("async_jobs"."max_steps" BETWEEN 1 AND 16 AND "async_jobs"."checkpoint" BETWEEN 0 AND "async_jobs"."max_steps" AND "async_jobs"."progress" BETWEEN 0 AND 100 AND "async_jobs"."attempts" BETWEEN 0 AND 5),
	CONSTRAINT "async_job_result_bound" CHECK("async_jobs"."result_reference" IS NULL OR length("async_jobs"."result_reference") <= 512),
	CONSTRAINT "async_job_id" CHECK(length("async_jobs"."id") = 36 AND "async_jobs"."id" = lower("async_jobs"."id") AND length(replace("async_jobs"."id", '-', '')) = 32 AND replace("async_jobs"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("async_jobs"."id",9,1) = '-' AND substr("async_jobs"."id",14,1) = '-' AND substr("async_jobs"."id",19,1) = '-' AND substr("async_jobs"."id",24,1) = '-' AND substr("async_jobs"."id",15,1) = '4' AND substr("async_jobs"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "async_job_updated" CHECK("async_jobs"."updated_at" IS NULL OR (typeof("async_jobs"."updated_at") = 'integer' AND "async_jobs"."updated_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "async_job_created" CHECK("async_jobs"."created_at" IS NULL OR (typeof("async_jobs"."created_at") = 'integer' AND "async_jobs"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE INDEX `async_job_pending` ON `async_jobs` (`status`,`lease_until`,`id`);