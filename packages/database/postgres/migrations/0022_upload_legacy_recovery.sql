CREATE TABLE "upload_legacy_recoveries" (
	"intent_id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"decision" jsonb NOT NULL,
	"state" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"lease_id" uuid,
	"lease_expires_at" bigint,
	"created_at" bigint NOT NULL,
	"released_at" bigint,
	CONSTRAINT "upload_legacy_recoveries_decision_id_unique" UNIQUE("decision_id"),
	CONSTRAINT "legacy_recovery_decision" CHECK (substr("upload_legacy_recoveries"."decision_id"::text,15,1) = '4' AND substr("upload_legacy_recoveries"."decision_id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "legacy_recovery_lease" CHECK (substr("upload_legacy_recoveries"."lease_id"::text,15,1) = '4' AND substr("upload_legacy_recoveries"."lease_id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "legacy_recovery_revision" CHECK ("upload_legacy_recoveries"."revision" BETWEEN 1 AND 2147483647 AND cast("upload_legacy_recoveries"."revision" as integer) = "upload_legacy_recoveries"."revision"),
	CONSTRAINT "legacy_recovery_created" CHECK ("upload_legacy_recoveries"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "legacy_recovery_lease_time" CHECK ("upload_legacy_recoveries"."lease_expires_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "legacy_recovery_state" CHECK (("upload_legacy_recoveries"."state" = 'deleting' AND "upload_legacy_recoveries"."released_at" IS NULL AND "upload_legacy_recoveries"."lease_id" IS NOT NULL) OR ("upload_legacy_recoveries"."state" = 'released' AND "upload_legacy_recoveries"."released_at" IS NOT NULL)),
	CONSTRAINT "legacy_recovery_lease_pair" CHECK (("upload_legacy_recoveries"."lease_id" IS NULL AND "upload_legacy_recoveries"."lease_expires_at" IS NULL) OR ("upload_legacy_recoveries"."lease_id" IS NOT NULL AND "upload_legacy_recoveries"."lease_expires_at" IS NOT NULL)),
	CONSTRAINT "legacy_recovery_release_time" CHECK ("upload_legacy_recoveries"."released_at" IS NULL OR ("upload_legacy_recoveries"."released_at" BETWEEN "upload_legacy_recoveries"."created_at" AND 8640000000000000 AND cast("upload_legacy_recoveries"."released_at" as bigint) = "upload_legacy_recoveries"."released_at")),
	CONSTRAINT "legacy_recovery_payload" CHECK (jsonb_typeof("upload_legacy_recoveries"."decision") = 'object' AND octet_length("upload_legacy_recoveries"."decision"::text) BETWEEN 1 AND 8192)
);
--> statement-breakpoint
ALTER TABLE "upload_legacy_recoveries" ADD CONSTRAINT "upload_legacy_recoveries_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_legacy_recoveries" ADD CONSTRAINT "legacy_recovery_intent_fk" FOREIGN KEY ("project_id","intent_id") REFERENCES "public"."upload_intents"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legacy_recovery_project_lookup" ON "upload_legacy_recoveries" USING btree ("project_id","intent_id");
--> statement-breakpoint
CREATE FUNCTION hyperbug_legacy_recovery_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
IF TG_OP IN ('DELETE', 'TRUNCATE') THEN RAISE EXCEPTION 'Retain legacy cleanup target' USING ERRCODE = '23514'; END IF;
PERFORM id FROM projects WHERE id = NEW.project_id FOR UPDATE;
IF TG_OP = 'INSERT' THEN
  PERFORM id FROM upload_intents WHERE id = NEW.intent_id AND project_id = NEW.project_id AND principal_id = NEW.principal_id FOR UPDATE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM upload_intent_details WHERE intent_id = NEW.intent_id) OR EXISTS (SELECT 1 FROM attachments WHERE upload_intent_id = NEW.intent_id) THEN RAISE EXCEPTION 'Legacy recovery requires unlinked legacy identity' USING ERRCODE = '23514'; END IF;
ELSE
  IF NEW.intent_id IS DISTINCT FROM OLD.intent_id OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.principal_id IS DISTINCT FROM OLD.principal_id OR NEW.decision_id IS DISTINCT FROM OLD.decision_id OR NEW.decision IS DISTINCT FROM OLD.decision OR NEW.created_at IS DISTINCT FROM OLD.created_at OR (OLD.state = 'released' AND NEW.state IS DISTINCT FROM OLD.state) OR (OLD.released_at IS NOT NULL AND NEW.released_at IS DISTINCT FROM OLD.released_at) THEN RAISE EXCEPTION 'Legacy recovery decision is immutable' USING ERRCODE = '23514'; END IF;
END IF;
RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER legacy_recovery_guard BEFORE INSERT OR UPDATE OR DELETE ON upload_legacy_recoveries FOR EACH ROW EXECUTE FUNCTION hyperbug_legacy_recovery_guard();
--> statement-breakpoint
CREATE TRIGGER legacy_recovery_no_truncate BEFORE TRUNCATE ON upload_legacy_recoveries FOR EACH STATEMENT EXECUTE FUNCTION hyperbug_legacy_recovery_guard();
--> statement-breakpoint
CREATE FUNCTION hyperbug_legacy_upload_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
PERFORM id FROM projects WHERE id = OLD.project_id FOR UPDATE;
IF NEW IS DISTINCT FROM OLD AND EXISTS (SELECT 1 FROM upload_legacy_recoveries WHERE intent_id = OLD.id) THEN RAISE EXCEPTION 'Retired legacy identity is immutable' USING ERRCODE = '23514'; END IF;
RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER legacy_upload_identity_guard BEFORE UPDATE ON upload_intents FOR EACH ROW EXECUTE FUNCTION hyperbug_legacy_upload_identity_guard();
--> statement-breakpoint
CREATE FUNCTION hyperbug_legacy_attachments_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
PERFORM id FROM projects WHERE id = NEW.project_id FOR UPDATE;
IF EXISTS (SELECT 1 FROM upload_legacy_recoveries WHERE intent_id = NEW.upload_intent_id) THEN RAISE EXCEPTION 'Legacy recovery prevents attachment or adoption' USING ERRCODE = '23514'; END IF;
RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER legacy_attachments_guard BEFORE INSERT OR UPDATE ON attachments FOR EACH ROW EXECUTE FUNCTION hyperbug_legacy_attachments_guard();
--> statement-breakpoint
CREATE FUNCTION hyperbug_legacy_upload_intent_details_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
PERFORM id FROM projects WHERE id = NEW.project_id FOR UPDATE;
IF EXISTS (SELECT 1 FROM upload_legacy_recoveries WHERE intent_id = NEW.intent_id) THEN RAISE EXCEPTION 'Legacy recovery prevents attachment or adoption' USING ERRCODE = '23514'; END IF;
RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER legacy_upload_intent_details_guard BEFORE INSERT OR UPDATE ON upload_intent_details FOR EACH ROW EXECUTE FUNCTION hyperbug_legacy_upload_intent_details_guard();
