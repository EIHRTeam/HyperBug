CREATE TABLE "upload_scan_results" (
	"intent_id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"policy_version" text NOT NULL,
	"status" text NOT NULL,
	"started_at" bigint NOT NULL,
	"completed_at" bigint,
	"evidence" jsonb,
	"failure_code" text,
	CONSTRAINT "scan_digest" CHECK ("upload_scan_results"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "scan_size" CHECK ("upload_scan_results"."size_bytes" BETWEEN 0 AND 9007199254740991 AND cast("upload_scan_results"."size_bytes" as bigint) = "upload_scan_results"."size_bytes"),
	CONSTRAINT "scan_policy" CHECK (length("upload_scan_results"."policy_version") BETWEEN 1 AND 64),
	CONSTRAINT "scan_result" CHECK (("upload_scan_results"."status" = 'pending' AND "upload_scan_results"."completed_at" IS NULL AND "upload_scan_results"."evidence" IS NULL AND "upload_scan_results"."failure_code" IS NULL) OR ("upload_scan_results"."status" IN ('clean','infected') AND "upload_scan_results"."completed_at" IS NOT NULL AND "upload_scan_results"."evidence" IS NOT NULL AND "upload_scan_results"."failure_code" IS NULL) OR ("upload_scan_results"."status" = 'failed' AND "upload_scan_results"."completed_at" IS NOT NULL AND "upload_scan_results"."evidence" IS NULL AND "upload_scan_results"."failure_code" IS NOT NULL AND "upload_scan_results"."failure_code" IN ('unavailable','timeout','partial','identity','invalid-result'))),
	CONSTRAINT "scan_attempt_id" CHECK (substr("upload_scan_results"."attempt_id"::text,15,1) = '4' AND substr("upload_scan_results"."attempt_id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "scan_started" CHECK ("upload_scan_results"."started_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "scan_finished" CHECK ("upload_scan_results"."completed_at" IS NULL OR ("upload_scan_results"."completed_at" BETWEEN "upload_scan_results"."started_at" AND 8640000000000000 AND cast("upload_scan_results"."completed_at" as bigint) = "upload_scan_results"."completed_at")),
	CONSTRAINT "scan_evidence" CHECK ("upload_scan_results"."evidence" IS NULL OR length("upload_scan_results"."evidence"::text) <= 65536),
	CONSTRAINT "scan_evidence_object" CHECK ("upload_scan_results"."evidence" IS NULL OR (jsonb_typeof("upload_scan_results"."evidence") = 'object' AND coalesce((jsonb_typeof("upload_scan_results"."evidence"->'engine') = 'string' AND length("upload_scan_results"."evidence"->>'engine') BETWEEN 1 AND 128) AND (jsonb_typeof("upload_scan_results"."evidence"->'engineVersion') = 'string' AND length("upload_scan_results"."evidence"->>'engineVersion') BETWEEN 1 AND 128) AND (jsonb_typeof("upload_scan_results"."evidence"->'signatureVersion') = 'string' AND length("upload_scan_results"."evidence"->>'signatureVersion') BETWEEN 1 AND 128), false)))
);
--> statement-breakpoint
ALTER TABLE "upload_scan_results" ADD CONSTRAINT "scan_intent_project_fk" FOREIGN KEY ("project_id","intent_id") REFERENCES "public"."upload_intents"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_pending_lookup" ON "upload_scan_results" USING btree ("status","intent_id");
--> statement-breakpoint
UPDATE upload_intents SET revision = revision + 1 WHERE id IN (SELECT intent_id FROM upload_intent_details WHERE policy_state = 'ready' OR scan_status != 'unscanned');
--> statement-breakpoint
UPDATE upload_intent_details SET policy_state = CASE WHEN policy_state = 'ready' THEN 'quarantined' ELSE policy_state END, scan_status = 'unscanned' WHERE policy_state = 'ready' OR scan_status != 'unscanned';
--> statement-breakpoint
CREATE FUNCTION hyperbug_upload_ready_scan_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
IF NEW.policy_state = 'ready' AND NOT (NEW.scan_status = 'clean' AND EXISTS (SELECT 1 FROM upload_scan_results s JOIN upload_intents i ON i.id = s.intent_id AND i.project_id = s.project_id WHERE s.intent_id = NEW.intent_id AND s.project_id = NEW.project_id AND s.status = 'clean' AND i.state = 'finalized' AND s.sha256 = i.verified_checksum AND s.size_bytes = i.actual_bytes AND s.evidence IS NOT NULL AND s.completed_at IS NOT NULL)) THEN RAISE EXCEPTION 'Ready requires clean immutable scan' USING ERRCODE = '23514'; END IF;
RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER upload_ready_scan_guard BEFORE INSERT OR UPDATE ON upload_intent_details FOR EACH ROW EXECUTE FUNCTION hyperbug_upload_ready_scan_guard();
--> statement-breakpoint
CREATE FUNCTION hyperbug_upload_scan_ready_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
IF EXISTS (SELECT 1 FROM upload_intent_details d WHERE d.intent_id = OLD.intent_id AND d.policy_state = 'ready') THEN RAISE EXCEPTION 'Quarantine before changing scan result' USING ERRCODE = '23514'; END IF;
IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER upload_scan_ready_guard BEFORE UPDATE OR DELETE ON upload_scan_results FOR EACH ROW EXECUTE FUNCTION hyperbug_upload_scan_ready_guard();
--> statement-breakpoint
CREATE FUNCTION hyperbug_upload_verified_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
IF OLD.state = 'finalized' AND (NEW.state IS DISTINCT FROM OLD.state OR NEW.principal_id IS DISTINCT FROM OLD.principal_id OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.object_key IS DISTINCT FROM OLD.object_key OR NEW.media_type IS DISTINCT FROM OLD.media_type OR NEW.actual_bytes IS DISTINCT FROM OLD.actual_bytes OR NEW.verified_checksum IS DISTINCT FROM OLD.verified_checksum OR NEW.verified_object_version IS DISTINCT FROM OLD.verified_object_version) THEN RAISE EXCEPTION 'Verified upload identity is immutable' USING ERRCODE = '23514'; END IF;
RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER upload_verified_identity_guard BEFORE UPDATE ON upload_intents FOR EACH ROW EXECUTE FUNCTION hyperbug_upload_verified_identity_guard();

--> statement-breakpoint
CREATE FUNCTION hyperbug_upload_verified_details_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
IF OLD.reservation_state = 'used' AND (NEW.final_key IS DISTINCT FROM OLD.final_key OR NEW.provider_version IS DISTINCT FROM OLD.provider_version) THEN RAISE EXCEPTION 'Verified final binding is immutable' USING ERRCODE = '23514'; END IF;
RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER upload_verified_details_guard BEFORE UPDATE ON upload_intent_details FOR EACH ROW EXECUTE FUNCTION hyperbug_upload_verified_details_guard();
