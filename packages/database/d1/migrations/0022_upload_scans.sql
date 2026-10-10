CREATE TABLE `upload_scan_results` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`policy_version` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`evidence` text,
	`failure_code` text,
	FOREIGN KEY (`project_id`,`intent_id`) REFERENCES `upload_intents`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "scan_digest" CHECK(length("upload_scan_results"."sha256") = 64 AND "upload_scan_results"."sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "scan_size" CHECK("upload_scan_results"."size_bytes" BETWEEN 0 AND 9007199254740991 AND cast("upload_scan_results"."size_bytes" as bigint) = "upload_scan_results"."size_bytes"),
	CONSTRAINT "scan_policy" CHECK(length("upload_scan_results"."policy_version") BETWEEN 1 AND 64),
	CONSTRAINT "scan_result" CHECK(("upload_scan_results"."status" = 'pending' AND "upload_scan_results"."completed_at" IS NULL AND "upload_scan_results"."evidence" IS NULL AND "upload_scan_results"."failure_code" IS NULL) OR ("upload_scan_results"."status" IN ('clean','infected') AND "upload_scan_results"."completed_at" IS NOT NULL AND "upload_scan_results"."evidence" IS NOT NULL AND "upload_scan_results"."failure_code" IS NULL) OR ("upload_scan_results"."status" = 'failed' AND "upload_scan_results"."completed_at" IS NOT NULL AND "upload_scan_results"."evidence" IS NULL AND "upload_scan_results"."failure_code" IS NOT NULL AND "upload_scan_results"."failure_code" IN ('unavailable','timeout','partial','identity','invalid-result'))),
	CONSTRAINT "scan_attempt_id" CHECK(length("upload_scan_results"."attempt_id") = 36 AND "upload_scan_results"."attempt_id" = lower("upload_scan_results"."attempt_id") AND length(replace("upload_scan_results"."attempt_id", '-', '')) = 32 AND replace("upload_scan_results"."attempt_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("upload_scan_results"."attempt_id",9,1) = '-' AND substr("upload_scan_results"."attempt_id",14,1) = '-' AND substr("upload_scan_results"."attempt_id",19,1) = '-' AND substr("upload_scan_results"."attempt_id",24,1) = '-' AND substr("upload_scan_results"."attempt_id",15,1) = '4' AND substr("upload_scan_results"."attempt_id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "scan_started" CHECK("upload_scan_results"."started_at" IS NULL OR (typeof("upload_scan_results"."started_at") = 'integer' AND "upload_scan_results"."started_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "scan_finished" CHECK("upload_scan_results"."completed_at" IS NULL OR ("upload_scan_results"."completed_at" BETWEEN "upload_scan_results"."started_at" AND 8640000000000000 AND cast("upload_scan_results"."completed_at" as bigint) = "upload_scan_results"."completed_at")),
	CONSTRAINT "scan_evidence" CHECK("upload_scan_results"."evidence" IS NULL OR (json_valid("upload_scan_results"."evidence") AND length("upload_scan_results"."evidence") <= 65536)),
	CONSTRAINT "scan_evidence_object" CHECK("upload_scan_results"."evidence" IS NULL OR (json_type("upload_scan_results"."evidence") = 'object' AND coalesce((json_type("upload_scan_results"."evidence", '$.engine') = 'text' AND length(json_extract("upload_scan_results"."evidence", '$.engine')) BETWEEN 1 AND 128) AND (json_type("upload_scan_results"."evidence", '$.engineVersion') = 'text' AND length(json_extract("upload_scan_results"."evidence", '$.engineVersion')) BETWEEN 1 AND 128) AND (json_type("upload_scan_results"."evidence", '$.signatureVersion') = 'text' AND length(json_extract("upload_scan_results"."evidence", '$.signatureVersion')) BETWEEN 1 AND 128), 0)))
);
--> statement-breakpoint
CREATE INDEX `scan_pending_lookup` ON `upload_scan_results` (`status`,`intent_id`);
--> statement-breakpoint
UPDATE upload_intents SET revision = revision + 1 WHERE id IN (SELECT intent_id FROM upload_intent_details WHERE policy_state = 'ready' OR scan_status != 'unscanned');
--> statement-breakpoint
UPDATE upload_intent_details SET policy_state = CASE WHEN policy_state = 'ready' THEN 'quarantined' ELSE policy_state END, scan_status = 'unscanned' WHERE policy_state = 'ready' OR scan_status != 'unscanned';
--> statement-breakpoint
CREATE TRIGGER upload_ready_scan_guard_insert BEFORE INSERT ON upload_intent_details WHEN NEW.policy_state = 'ready' AND NOT (NEW.scan_status = 'clean' AND EXISTS (SELECT 1 FROM upload_scan_results s JOIN upload_intents i ON i.id = s.intent_id AND i.project_id = s.project_id WHERE s.intent_id = NEW.intent_id AND s.project_id = NEW.project_id AND s.status = 'clean' AND i.state = 'finalized' AND s.sha256 = i.verified_checksum AND s.size_bytes = i.actual_bytes AND s.evidence IS NOT NULL AND s.completed_at IS NOT NULL)) BEGIN SELECT RAISE(ABORT, 'Ready requires clean immutable scan'); END;
--> statement-breakpoint
CREATE TRIGGER upload_ready_scan_guard_update BEFORE UPDATE ON upload_intent_details WHEN NEW.policy_state = 'ready' AND NOT (NEW.scan_status = 'clean' AND EXISTS (SELECT 1 FROM upload_scan_results s JOIN upload_intents i ON i.id = s.intent_id AND i.project_id = s.project_id WHERE s.intent_id = NEW.intent_id AND s.project_id = NEW.project_id AND s.status = 'clean' AND i.state = 'finalized' AND s.sha256 = i.verified_checksum AND s.size_bytes = i.actual_bytes AND s.evidence IS NOT NULL AND s.completed_at IS NOT NULL)) BEGIN SELECT RAISE(ABORT, 'Ready requires clean immutable scan'); END;
--> statement-breakpoint
CREATE TRIGGER upload_scan_ready_guard_update BEFORE UPDATE ON upload_scan_results WHEN EXISTS (SELECT 1 FROM upload_intent_details d WHERE d.intent_id = OLD.intent_id AND d.policy_state = 'ready') BEGIN SELECT RAISE(ABORT, 'Quarantine before changing scan result'); END;
--> statement-breakpoint
CREATE TRIGGER upload_scan_ready_guard_delete BEFORE DELETE ON upload_scan_results WHEN EXISTS (SELECT 1 FROM upload_intent_details d WHERE d.intent_id = OLD.intent_id AND d.policy_state = 'ready') BEGIN SELECT RAISE(ABORT, 'Quarantine before changing scan result'); END;
--> statement-breakpoint
CREATE TRIGGER upload_verified_identity_guard BEFORE UPDATE ON upload_intents WHEN OLD.state = 'finalized' AND (NEW.state IS NOT OLD.state OR NEW.principal_id IS NOT OLD.principal_id OR NEW.project_id IS NOT OLD.project_id OR NEW.object_key IS NOT OLD.object_key OR NEW.media_type IS NOT OLD.media_type OR NEW.actual_bytes IS NOT OLD.actual_bytes OR NEW.verified_checksum IS NOT OLD.verified_checksum OR NEW.verified_object_version IS NOT OLD.verified_object_version) BEGIN SELECT RAISE(ABORT, 'Verified upload identity is immutable'); END;

--> statement-breakpoint
CREATE TRIGGER upload_verified_details_guard BEFORE UPDATE ON upload_intent_details WHEN OLD.reservation_state = 'used' AND (NEW.final_key IS NOT OLD.final_key OR NEW.provider_version IS NOT OLD.provider_version) BEGIN SELECT RAISE(ABORT, 'Verified final binding is immutable'); END;
