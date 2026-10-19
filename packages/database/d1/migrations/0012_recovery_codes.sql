CREATE TABLE `recovery_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`generation` integer NOT NULL,
	`digest` text NOT NULL,
	`created_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recovery_code_id" CHECK(length("recovery_codes"."id") = 36 AND "recovery_codes"."id" = lower("recovery_codes"."id") AND length(replace("recovery_codes"."id", '-', '')) = 32 AND replace("recovery_codes"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("recovery_codes"."id",9,1) = '-' AND substr("recovery_codes"."id",14,1) = '-' AND substr("recovery_codes"."id",19,1) = '-' AND substr("recovery_codes"."id",24,1) = '-' AND substr("recovery_codes"."id",15,1) = '4' AND substr("recovery_codes"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "recovery_code_created" CHECK("recovery_codes"."created_at" IS NULL OR (typeof("recovery_codes"."created_at") = 'integer' AND "recovery_codes"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "recovery_code_used" CHECK("recovery_codes"."used_at" IS NULL OR (typeof("recovery_codes"."used_at") = 'integer' AND "recovery_codes"."used_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "recovery_code_digest" CHECK(json_valid("recovery_codes"."digest") AND length("recovery_codes"."digest") <= 65536),
	CONSTRAINT "recovery_code_generation" CHECK("recovery_codes"."generation" BETWEEN 1 AND 2147483647),
	CONSTRAINT "recovery_code_time_order" CHECK("recovery_codes"."used_at" IS NULL OR "recovery_codes"."used_at" >= "recovery_codes"."created_at")
);
--> statement-breakpoint
CREATE INDEX `recovery_code_identity` ON `recovery_codes` (`identity_id`,`generation`);