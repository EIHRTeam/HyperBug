CREATE TABLE `upload_legacy_recoveries` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`principal_id` text NOT NULL,
	`decision_id` text NOT NULL,
	`decision` text NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`lease_id` text,
	`lease_expires_at` integer,
	`created_at` integer NOT NULL,
	`released_at` integer,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`,`intent_id`) REFERENCES `upload_intents`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "legacy_recovery_decision" CHECK(length("upload_legacy_recoveries"."decision_id") = 36 AND "upload_legacy_recoveries"."decision_id" = lower("upload_legacy_recoveries"."decision_id") AND length(replace("upload_legacy_recoveries"."decision_id", '-', '')) = 32 AND replace("upload_legacy_recoveries"."decision_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("upload_legacy_recoveries"."decision_id",9,1) = '-' AND substr("upload_legacy_recoveries"."decision_id",14,1) = '-' AND substr("upload_legacy_recoveries"."decision_id",19,1) = '-' AND substr("upload_legacy_recoveries"."decision_id",24,1) = '-' AND substr("upload_legacy_recoveries"."decision_id",15,1) = '4' AND substr("upload_legacy_recoveries"."decision_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "legacy_recovery_lease" CHECK(length("upload_legacy_recoveries"."lease_id") = 36 AND "upload_legacy_recoveries"."lease_id" = lower("upload_legacy_recoveries"."lease_id") AND length(replace("upload_legacy_recoveries"."lease_id", '-', '')) = 32 AND replace("upload_legacy_recoveries"."lease_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("upload_legacy_recoveries"."lease_id",9,1) = '-' AND substr("upload_legacy_recoveries"."lease_id",14,1) = '-' AND substr("upload_legacy_recoveries"."lease_id",19,1) = '-' AND substr("upload_legacy_recoveries"."lease_id",24,1) = '-' AND substr("upload_legacy_recoveries"."lease_id",15,1) = '4' AND substr("upload_legacy_recoveries"."lease_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "legacy_recovery_revision" CHECK("upload_legacy_recoveries"."revision" BETWEEN 1 AND 2147483647 AND cast("upload_legacy_recoveries"."revision" as integer) = "upload_legacy_recoveries"."revision"),
	CONSTRAINT "legacy_recovery_created" CHECK("upload_legacy_recoveries"."created_at" IS NULL OR (typeof("upload_legacy_recoveries"."created_at") = 'integer' AND "upload_legacy_recoveries"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "legacy_recovery_lease_time" CHECK("upload_legacy_recoveries"."lease_expires_at" IS NULL OR (typeof("upload_legacy_recoveries"."lease_expires_at") = 'integer' AND "upload_legacy_recoveries"."lease_expires_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "legacy_recovery_state" CHECK(("upload_legacy_recoveries"."state" = 'deleting' AND "upload_legacy_recoveries"."released_at" IS NULL AND "upload_legacy_recoveries"."lease_id" IS NOT NULL) OR ("upload_legacy_recoveries"."state" = 'released' AND "upload_legacy_recoveries"."released_at" IS NOT NULL)),
	CONSTRAINT "legacy_recovery_lease_pair" CHECK(("upload_legacy_recoveries"."lease_id" IS NULL AND "upload_legacy_recoveries"."lease_expires_at" IS NULL) OR ("upload_legacy_recoveries"."lease_id" IS NOT NULL AND "upload_legacy_recoveries"."lease_expires_at" IS NOT NULL)),
	CONSTRAINT "legacy_recovery_release_time" CHECK("upload_legacy_recoveries"."released_at" IS NULL OR ("upload_legacy_recoveries"."released_at" BETWEEN "upload_legacy_recoveries"."created_at" AND 8640000000000000 AND cast("upload_legacy_recoveries"."released_at" as bigint) = "upload_legacy_recoveries"."released_at")),
	CONSTRAINT "legacy_recovery_payload" CHECK(json_valid("upload_legacy_recoveries"."decision") AND json_type("upload_legacy_recoveries"."decision") = 'object' AND length(cast("upload_legacy_recoveries"."decision" as blob)) BETWEEN 1 AND 8192)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_legacy_recoveries_decision_id_unique` ON `upload_legacy_recoveries` (`decision_id`);--> statement-breakpoint
CREATE INDEX `legacy_recovery_project_lookup` ON `upload_legacy_recoveries` (`project_id`,`intent_id`);
--> statement-breakpoint
CREATE TRIGGER legacy_recovery_insert_guard BEFORE INSERT ON upload_legacy_recoveries WHEN EXISTS (SELECT 1 FROM upload_legacy_recoveries r WHERE r.intent_id = NEW.intent_id OR r.decision_id = NEW.decision_id) OR NOT EXISTS (SELECT 1 FROM upload_intents i WHERE i.id = NEW.intent_id AND i.project_id = NEW.project_id AND i.principal_id = NEW.principal_id) OR EXISTS (SELECT 1 FROM upload_intent_details d WHERE d.intent_id = NEW.intent_id) OR EXISTS (SELECT 1 FROM attachments a WHERE a.upload_intent_id = NEW.intent_id) BEGIN SELECT RAISE(ABORT, 'Legacy recovery requires unlinked legacy identity'); END;
--> statement-breakpoint
CREATE TRIGGER legacy_recovery_identity_guard BEFORE UPDATE ON upload_legacy_recoveries WHEN NEW.intent_id IS NOT OLD.intent_id OR NEW.project_id IS NOT OLD.project_id OR NEW.principal_id IS NOT OLD.principal_id OR NEW.decision_id IS NOT OLD.decision_id OR NEW.decision IS NOT OLD.decision OR NEW.created_at IS NOT OLD.created_at OR (OLD.state = 'released' AND NEW.state IS NOT OLD.state) OR (OLD.released_at IS NOT NULL AND NEW.released_at IS NOT OLD.released_at) BEGIN SELECT RAISE(ABORT, 'Legacy recovery decision is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER legacy_recovery_delete_guard BEFORE DELETE ON upload_legacy_recoveries BEGIN SELECT RAISE(ABORT, 'Retain legacy cleanup target'); END;
--> statement-breakpoint
CREATE TRIGGER legacy_upload_identity_guard BEFORE UPDATE ON upload_intents WHEN EXISTS (SELECT 1 FROM upload_legacy_recoveries r WHERE r.intent_id = OLD.id) AND (NEW.id IS NOT OLD.id OR NEW.project_id IS NOT OLD.project_id OR NEW.principal_id IS NOT OLD.principal_id OR NEW.object_key IS NOT OLD.object_key OR NEW.media_type IS NOT OLD.media_type OR NEW.max_bytes IS NOT OLD.max_bytes OR NEW.state IS NOT OLD.state OR NEW.revision IS NOT OLD.revision OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR NEW.verified_object_version IS NOT OLD.verified_object_version OR NEW.verified_checksum IS NOT OLD.verified_checksum OR NEW.actual_bytes IS NOT OLD.actual_bytes) BEGIN SELECT RAISE(ABORT, 'Retired legacy identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER legacy_attachments_insert_guard BEFORE INSERT ON attachments WHEN EXISTS (SELECT 1 FROM upload_legacy_recoveries r WHERE r.intent_id = NEW.upload_intent_id) BEGIN SELECT RAISE(ABORT, 'Legacy recovery prevents attachment or adoption'); END;
--> statement-breakpoint
CREATE TRIGGER legacy_attachments_update_guard BEFORE UPDATE ON attachments WHEN EXISTS (SELECT 1 FROM upload_legacy_recoveries r WHERE r.intent_id = NEW.upload_intent_id) BEGIN SELECT RAISE(ABORT, 'Legacy recovery prevents attachment or adoption'); END;
--> statement-breakpoint
CREATE TRIGGER legacy_upload_intent_details_insert_guard BEFORE INSERT ON upload_intent_details WHEN EXISTS (SELECT 1 FROM upload_legacy_recoveries r WHERE r.intent_id = NEW.intent_id) BEGIN SELECT RAISE(ABORT, 'Legacy recovery prevents attachment or adoption'); END;
--> statement-breakpoint
CREATE TRIGGER legacy_upload_intent_details_update_guard BEFORE UPDATE ON upload_intent_details WHEN EXISTS (SELECT 1 FROM upload_legacy_recoveries r WHERE r.intent_id = NEW.intent_id) BEGIN SELECT RAISE(ABORT, 'Legacy recovery prevents attachment or adoption'); END;
