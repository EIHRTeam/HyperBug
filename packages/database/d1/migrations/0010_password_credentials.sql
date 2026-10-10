CREATE TABLE `password_credentials` (
	`identity_id` text PRIMARY KEY NOT NULL,
	`record` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "password_credential_record" CHECK(json_valid("password_credentials"."record") AND length("password_credentials"."record") <= 65536),
	CONSTRAINT "password_credential_revision" CHECK("password_credentials"."revision" BETWEEN 1 AND 2147483647 AND cast("password_credentials"."revision" as integer) = "password_credentials"."revision"),
	CONSTRAINT "password_credential_created" CHECK("password_credentials"."created_at" IS NULL OR (typeof("password_credentials"."created_at") = 'integer' AND "password_credentials"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "password_credential_updated" CHECK("password_credentials"."updated_at" IS NULL OR (typeof("password_credentials"."updated_at") = 'integer' AND "password_credentials"."updated_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "password_credential_time_order" CHECK("password_credentials"."updated_at" >= "password_credentials"."created_at")
);
