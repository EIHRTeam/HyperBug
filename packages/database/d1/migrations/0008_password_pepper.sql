-- Reviewed D1 rebuild: preserve existing key references and restore lifecycle guards.
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_key_versions` (
	`purpose` text NOT NULL,
	`key_id` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`purpose`, `key_id`, `version`),
	CONSTRAINT "key_purpose" CHECK("__new_key_versions"."purpose" IN ('token-hmac','blind-index','envelope-kek','password-pepper')),
	CONSTRAINT "key_id_length" CHECK(length("__new_key_versions"."key_id") BETWEEN 1 AND 64),
	CONSTRAINT "key_version" CHECK("__new_key_versions"."version" BETWEEN 1 AND 2147483647 AND cast("__new_key_versions"."version" as integer) = "__new_key_versions"."version"),
	CONSTRAINT "key_state" CHECK("__new_key_versions"."state" IN ('current','previous','revoked','removed')),
	CONSTRAINT "key_created" CHECK("__new_key_versions"."created_at" IS NULL OR (typeof("__new_key_versions"."created_at") = 'integer' AND "__new_key_versions"."created_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
INSERT INTO `__new_key_versions`("purpose", "key_id", "version", "state", "created_at") SELECT "purpose", "key_id", "version", "state", "created_at" FROM `key_versions`;--> statement-breakpoint
DROP TABLE `key_versions`;--> statement-breakpoint
ALTER TABLE `__new_key_versions` RENAME TO `key_versions`;--> statement-breakpoint
CREATE UNIQUE INDEX `key_one_current` ON `key_versions` (`purpose`) WHERE "key_versions"."state" = 'current';--> statement-breakpoint
CREATE INDEX `key_state_purpose` ON `key_versions` (`state`,`purpose`);--> statement-breakpoint
CREATE INDEX `key_active_versions` ON `key_versions` (`purpose`,`key_id`,`version`) WHERE "key_versions"."state" != 'removed';--> statement-breakpoint
CREATE TRIGGER key_versions_transition BEFORE UPDATE ON key_versions WHEN
  NEW.purpose != OLD.purpose OR NEW.key_id != OLD.key_id OR NEW.version != OLD.version OR NEW.created_at != OLD.created_at OR
  NOT (NEW.state = OLD.state OR (OLD.state = 'current' AND NEW.state IN ('previous','revoked')) OR (OLD.state = 'previous' AND NEW.state IN ('revoked','removed')) OR (OLD.state = 'revoked' AND NEW.state = 'removed')) OR
  (NEW.state = 'removed' AND (EXISTS (SELECT 1 FROM protected_records WHERE purpose = OLD.purpose AND key_id = OLD.key_id AND key_version = OLD.version) OR EXISTS (SELECT 1 FROM key_backup_references WHERE purpose = OLD.purpose AND key_id = OLD.key_id AND key_version = OLD.version)))
BEGIN SELECT RAISE(ABORT, 'invalid key lifecycle transition'); END;--> statement-breakpoint
CREATE TRIGGER key_versions_no_delete BEFORE DELETE ON key_versions BEGIN SELECT RAISE(ABORT, 'key identities are permanent'); END;--> statement-breakpoint
CREATE TRIGGER key_versions_no_replace BEFORE INSERT ON key_versions WHEN EXISTS (SELECT 1 FROM key_versions WHERE purpose = NEW.purpose AND key_id = NEW.key_id AND version = NEW.version) BEGIN SELECT RAISE(ABORT, 'key identities are permanent'); END;--> statement-breakpoint
CREATE TABLE __migration_integrity_guard (violations INTEGER NOT NULL CHECK (violations = 0));--> statement-breakpoint
INSERT INTO __migration_integrity_guard SELECT count(*) FROM pragma_foreign_key_check;--> statement-breakpoint
DROP TABLE __migration_integrity_guard;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
