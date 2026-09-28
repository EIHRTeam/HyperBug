CREATE TABLE `key_backup_references` (
	`backup_id` text NOT NULL,
	`purpose` text NOT NULL,
	`key_id` text NOT NULL,
	`key_version` integer NOT NULL,
	PRIMARY KEY(`backup_id`, `purpose`, `key_id`, `key_version`),
	FOREIGN KEY (`backup_id`) REFERENCES `key_backups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purpose`,`key_id`,`key_version`) REFERENCES `key_versions`(`purpose`,`key_id`,`version`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `key_backup_reference_key` ON `key_backup_references` (`purpose`,`key_id`,`key_version`);--> statement-breakpoint
CREATE TABLE `key_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`retain_until` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "key_backup_id" CHECK(length("key_backups"."id") = 36 AND "key_backups"."id" = lower("key_backups"."id") AND length(replace("key_backups"."id", '-', '')) = 32 AND replace("key_backups"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("key_backups"."id",9,1) = '-' AND substr("key_backups"."id",14,1) = '-' AND substr("key_backups"."id",19,1) = '-' AND substr("key_backups"."id",24,1) = '-' AND substr("key_backups"."id",15,1) = '4' AND substr("key_backups"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "key_backup_state" CHECK("key_backups"."state" IN ('capturing','retained','released')),
	CONSTRAINT "key_backup_retention" CHECK("key_backups"."retain_until" > "key_backups"."created_at"),
	CONSTRAINT "key_backup_created" CHECK("key_backups"."created_at" IS NULL OR (typeof("key_backups"."created_at") = 'integer' AND "key_backups"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "key_backup_until" CHECK("key_backups"."retain_until" IS NULL OR (typeof("key_backups"."retain_until") = 'integer' AND "key_backups"."retain_until" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE INDEX `key_backup_state_index` ON `key_backups` (`state`);--> statement-breakpoint
CREATE TABLE `key_registry_control` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`generation` integer NOT NULL,
	CONSTRAINT "key_registry_singleton" CHECK("key_registry_control"."singleton" = 1),
	CONSTRAINT "key_registry_generation" CHECK("key_registry_control"."generation" BETWEEN 1 AND 2147483647 AND cast("key_registry_control"."generation" as integer) = "key_registry_control"."generation")
);
--> statement-breakpoint
CREATE TABLE `key_versions` (
	`purpose` text NOT NULL,
	`key_id` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`purpose`, `key_id`, `version`),
	CONSTRAINT "key_purpose" CHECK("key_versions"."purpose" IN ('token-hmac','blind-index','envelope-kek')),
	CONSTRAINT "key_id_length" CHECK(length("key_versions"."key_id") BETWEEN 1 AND 64),
	CONSTRAINT "key_version" CHECK("key_versions"."version" BETWEEN 1 AND 2147483647 AND cast("key_versions"."version" as integer) = "key_versions"."version"),
	CONSTRAINT "key_state" CHECK("key_versions"."state" IN ('current','previous','revoked','removed')),
	CONSTRAINT "key_created" CHECK("key_versions"."created_at" IS NULL OR (typeof("key_versions"."created_at") = 'integer' AND "key_versions"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `key_one_current` ON `key_versions` (`purpose`) WHERE "key_versions"."state" = 'current';--> statement-breakpoint
CREATE INDEX `key_state_purpose` ON `key_versions` (`state`,`purpose`);--> statement-breakpoint
CREATE TABLE `protected_records` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`purpose` text NOT NULL,
	`key_id` text NOT NULL,
	`key_version` integer NOT NULL,
	`record` text NOT NULL,
	FOREIGN KEY (`purpose`,`key_id`,`key_version`) REFERENCES `key_versions`(`purpose`,`key_id`,`version`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "protected_record_id" CHECK(length("protected_records"."id") = 36 AND "protected_records"."id" = lower("protected_records"."id") AND length(replace("protected_records"."id", '-', '')) = 32 AND replace("protected_records"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("protected_records"."id",9,1) = '-' AND substr("protected_records"."id",14,1) = '-' AND substr("protected_records"."id",19,1) = '-' AND substr("protected_records"."id",24,1) = '-' AND substr("protected_records"."id",15,1) = '4' AND substr("protected_records"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "protected_record_revision" CHECK("protected_records"."revision" BETWEEN 1 AND 2147483647 AND cast("protected_records"."revision" as integer) = "protected_records"."revision"),
	CONSTRAINT "protected_record_json" CHECK(json_valid("protected_records"."record") AND length("protected_records"."record") <= 65536),
	CONSTRAINT "protected_record_reference" CHECK(coalesce(json_extract("protected_records"."record", '$.key.purpose') = "protected_records"."purpose" AND json_extract("protected_records"."record", '$.key.id') = "protected_records"."key_id" AND json_extract("protected_records"."record", '$.key.version') = "protected_records"."key_version", false))
);
--> statement-breakpoint
CREATE INDEX `protected_record_key` ON `protected_records` (`purpose`,`key_id`,`key_version`);
--> statement-breakpoint
INSERT INTO key_registry_control (singleton, generation) VALUES (1, 1);
--> statement-breakpoint
-- Registry identities are permanent; physical secret removal follows an audited tombstone.
CREATE TRIGGER key_versions_transition BEFORE UPDATE ON key_versions WHEN
  NEW.purpose != OLD.purpose OR NEW.key_id != OLD.key_id OR NEW.version != OLD.version OR NEW.created_at != OLD.created_at OR
  NOT (NEW.state = OLD.state OR (OLD.state = 'current' AND NEW.state IN ('previous','revoked')) OR (OLD.state = 'previous' AND NEW.state IN ('revoked','removed')) OR (OLD.state = 'revoked' AND NEW.state = 'removed')) OR
  (NEW.state = 'removed' AND (EXISTS (SELECT 1 FROM protected_records WHERE purpose = OLD.purpose AND key_id = OLD.key_id AND key_version = OLD.version) OR EXISTS (SELECT 1 FROM key_backup_references WHERE purpose = OLD.purpose AND key_id = OLD.key_id AND key_version = OLD.version)))
BEGIN SELECT RAISE(ABORT, 'invalid key lifecycle transition'); END;
--> statement-breakpoint
CREATE TRIGGER key_versions_no_delete BEFORE DELETE ON key_versions BEGIN SELECT RAISE(ABORT, 'key identities are permanent'); END;
--> statement-breakpoint
CREATE TRIGGER key_versions_no_replace BEFORE INSERT ON key_versions WHEN EXISTS (SELECT 1 FROM key_versions WHERE purpose = NEW.purpose AND key_id = NEW.key_id AND version = NEW.version) BEGIN SELECT RAISE(ABORT, 'key identities are permanent'); END;
