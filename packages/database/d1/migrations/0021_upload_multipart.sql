CREATE TABLE `upload_multipart_sessions` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`part_bytes` integer NOT NULL,
	`max_parts` integer NOT NULL,
	`state` text DEFAULT 'planned' NOT NULL,
	`provider_upload_id` text,
	`parts` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`project_id`,`intent_id`) REFERENCES `upload_intents`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "multipart_plan" CHECK("upload_multipart_sessions"."part_bytes" BETWEEN 5242880 AND 5368709120 AND cast("upload_multipart_sessions"."part_bytes" as bigint) = "upload_multipart_sessions"."part_bytes" AND "upload_multipart_sessions"."max_parts" BETWEEN 1 AND 10000),
	CONSTRAINT "multipart_state" CHECK("upload_multipart_sessions"."state" IN ('planned','creating','active','completing','completed','aborting','aborted')),
	CONSTRAINT "multipart_provider" CHECK(("upload_multipart_sessions"."provider_upload_id" IS NULL AND "upload_multipart_sessions"."state" IN ('planned','creating','aborting','aborted')) OR ("upload_multipart_sessions"."provider_upload_id" IS NOT NULL AND length("upload_multipart_sessions"."provider_upload_id") BETWEEN 1 AND 2048 AND "upload_multipart_sessions"."state" NOT IN ('planned','creating'))),
	CONSTRAINT "multipart_catalog" CHECK(json_valid("upload_multipart_sessions"."parts") AND length("upload_multipart_sessions"."parts") <= 65536),
	CONSTRAINT "multipart_catalog_array" CHECK(json_type("upload_multipart_sessions"."parts") = 'array' AND json_array_length("upload_multipart_sessions"."parts") <= "upload_multipart_sessions"."max_parts"),
	CONSTRAINT "multipart_revision" CHECK("upload_multipart_sessions"."revision" BETWEEN 1 AND 2147483647 AND cast("upload_multipart_sessions"."revision" as integer) = "upload_multipart_sessions"."revision")
);
--> statement-breakpoint
CREATE INDEX `multipart_state_lookup` ON `upload_multipart_sessions` (`state`,`intent_id`);