CREATE TABLE `principal_upload_usage` (
	`principal_id` text PRIMARY KEY NOT NULL,
	`reserved_bytes` integer DEFAULT 0 NOT NULL,
	`used_bytes` integer DEFAULT 0 NOT NULL,
	`reserved_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "principal_upload_usage_bound" CHECK("principal_upload_usage"."reserved_bytes" >= 0 AND "principal_upload_usage"."used_bytes" >= 0 AND "principal_upload_usage"."reserved_bytes" <= 9007199254740991 - "principal_upload_usage"."used_bytes" AND cast("principal_upload_usage"."reserved_bytes" as bigint) = "principal_upload_usage"."reserved_bytes" AND cast("principal_upload_usage"."used_bytes" as bigint) = "principal_upload_usage"."used_bytes" AND "principal_upload_usage"."reserved_count" BETWEEN 0 AND 10000 AND cast("principal_upload_usage"."reserved_count" as bigint) = "principal_upload_usage"."reserved_count")
);
--> statement-breakpoint
CREATE TABLE `project_upload_usage` (
	`project_id` text PRIMARY KEY NOT NULL,
	`reserved_bytes` integer DEFAULT 0 NOT NULL,
	`used_bytes` integer DEFAULT 0 NOT NULL,
	`reserved_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_upload_usage_bound" CHECK("project_upload_usage"."reserved_bytes" >= 0 AND "project_upload_usage"."used_bytes" >= 0 AND "project_upload_usage"."reserved_bytes" <= 9007199254740991 - "project_upload_usage"."used_bytes" AND cast("project_upload_usage"."reserved_bytes" as bigint) = "project_upload_usage"."reserved_bytes" AND cast("project_upload_usage"."used_bytes" as bigint) = "project_upload_usage"."used_bytes" AND "project_upload_usage"."reserved_count" BETWEEN 0 AND 10000 AND cast("project_upload_usage"."reserved_count" as bigint) = "project_upload_usage"."reserved_count")
);
--> statement-breakpoint
CREATE TABLE `upload_intent_details` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`filename` text NOT NULL,
	`final_key` text NOT NULL,
	`association_kind` text NOT NULL,
	`draft_id` text,
	`issue_id` text,
	`comment_id` text,
	`lease_id` text,
	`lease_expires_at` integer,
	`provider_version` text,
	`reservation_state` text DEFAULT 'reserved' NOT NULL,
	`scan_status` text DEFAULT 'unscanned' NOT NULL,
	`policy_state` text DEFAULT 'quarantined' NOT NULL,
	FOREIGN KEY (`project_id`,`intent_id`) REFERENCES `upload_intents`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`comment_id`) REFERENCES `comments`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "upload_details_association" CHECK(("upload_intent_details"."association_kind" = 'issue-draft' AND "upload_intent_details"."draft_id" IS NOT NULL AND "upload_intent_details"."issue_id" IS NULL AND "upload_intent_details"."comment_id" IS NULL) OR ("upload_intent_details"."association_kind" = 'comment-draft' AND "upload_intent_details"."draft_id" IS NOT NULL AND "upload_intent_details"."issue_id" IS NOT NULL AND "upload_intent_details"."comment_id" IS NULL) OR ("upload_intent_details"."association_kind" = 'issue' AND "upload_intent_details"."draft_id" IS NULL AND "upload_intent_details"."issue_id" IS NOT NULL AND "upload_intent_details"."comment_id" IS NULL) OR ("upload_intent_details"."association_kind" = 'comment' AND "upload_intent_details"."draft_id" IS NULL AND "upload_intent_details"."issue_id" IS NULL AND "upload_intent_details"."comment_id" IS NOT NULL)),
	CONSTRAINT "upload_details_lease" CHECK(("upload_intent_details"."lease_id" IS NULL AND "upload_intent_details"."lease_expires_at" IS NULL) OR ("upload_intent_details"."lease_id" IS NOT NULL AND "upload_intent_details"."lease_expires_at" IS NOT NULL)),
	CONSTRAINT "upload_details_reservation" CHECK("upload_intent_details"."reservation_state" IN ('reserved','used','released')),
	CONSTRAINT "upload_details_scan" CHECK("upload_intent_details"."scan_status" IN ('unscanned','pending','clean','infected','failed')),
	CONSTRAINT "upload_details_policy" CHECK("upload_intent_details"."policy_state" IN ('quarantined','ready','rejected','deleted') AND ("upload_intent_details"."policy_state" != 'ready' OR "upload_intent_details"."scan_status" IN ('unscanned','clean'))),
	CONSTRAINT "upload_details_filename" CHECK(length("upload_intent_details"."filename") <= 255),
	CONSTRAINT "upload_details_final_key" CHECK(length("upload_intent_details"."final_key") <= 1024),
	CONSTRAINT "upload_details_provider_version" CHECK(length("upload_intent_details"."provider_version") <= 1024),
	CONSTRAINT "upload_details_draft" CHECK(length("upload_intent_details"."draft_id") = 36 AND "upload_intent_details"."draft_id" = lower("upload_intent_details"."draft_id") AND length(replace("upload_intent_details"."draft_id", '-', '')) = 32 AND replace("upload_intent_details"."draft_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("upload_intent_details"."draft_id",9,1) = '-' AND substr("upload_intent_details"."draft_id",14,1) = '-' AND substr("upload_intent_details"."draft_id",19,1) = '-' AND substr("upload_intent_details"."draft_id",24,1) = '-' AND substr("upload_intent_details"."draft_id",15,1) = '4' AND substr("upload_intent_details"."draft_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "upload_details_lease_id" CHECK(length("upload_intent_details"."lease_id") = 36 AND "upload_intent_details"."lease_id" = lower("upload_intent_details"."lease_id") AND length(replace("upload_intent_details"."lease_id", '-', '')) = 32 AND replace("upload_intent_details"."lease_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("upload_intent_details"."lease_id",9,1) = '-' AND substr("upload_intent_details"."lease_id",14,1) = '-' AND substr("upload_intent_details"."lease_id",19,1) = '-' AND substr("upload_intent_details"."lease_id",24,1) = '-' AND substr("upload_intent_details"."lease_id",15,1) = '4' AND substr("upload_intent_details"."lease_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "upload_details_lease_time" CHECK("upload_intent_details"."lease_expires_at" IS NULL OR (typeof("upload_intent_details"."lease_expires_at") = 'integer' AND "upload_intent_details"."lease_expires_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_intent_details_final_key_unique` ON `upload_intent_details` (`final_key`);--> statement-breakpoint
CREATE INDEX `upload_details_draft_lookup` ON `upload_intent_details` (`project_id`,`draft_id`,`intent_id`);--> statement-breakpoint
CREATE INDEX `upload_details_lease_lookup` ON `upload_intent_details` (`lease_expires_at`,`intent_id`);
--> statement-breakpoint
-- Preserve historical storage accounting; legacy intents remain unsupported by the new lifecycle.
INSERT INTO project_upload_usage (project_id, reserved_bytes, used_bytes, reserved_count)
SELECT project_id,
  SUM(CASE WHEN state = 'finalized' THEN 0 ELSE max_bytes END),
  SUM(CASE WHEN state = 'finalized' THEN actual_bytes ELSE 0 END),
  SUM(CASE WHEN state = 'finalized' THEN 0 ELSE 1 END)
FROM upload_intents GROUP BY project_id;

--> statement-breakpoint
-- Preserve historical storage accounting; legacy intents remain unsupported by the new lifecycle.
INSERT INTO principal_upload_usage (principal_id, reserved_bytes, used_bytes, reserved_count)
SELECT principal_id,
  SUM(CASE WHEN state = 'finalized' THEN 0 ELSE max_bytes END),
  SUM(CASE WHEN state = 'finalized' THEN actual_bytes ELSE 0 END),
  SUM(CASE WHEN state = 'finalized' THEN 0 ELSE 1 END)
FROM upload_intents GROUP BY principal_id;
