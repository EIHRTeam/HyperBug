CREATE TABLE "key_backup_references" (
	"backup_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"key_id" text NOT NULL,
	"key_version" integer NOT NULL,
	CONSTRAINT "key_backup_references_backup_id_purpose_key_id_key_version_pk" PRIMARY KEY("backup_id","purpose","key_id","key_version")
);
--> statement-breakpoint
CREATE TABLE "key_backups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"retain_until" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "key_backup_id" CHECK (substr("key_backups"."id"::text,15,1) = '4' AND substr("key_backups"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "key_backup_state" CHECK ("key_backups"."state" IN ('capturing','retained','released')),
	CONSTRAINT "key_backup_retention" CHECK ("key_backups"."retain_until" > "key_backups"."created_at"),
	CONSTRAINT "key_backup_created" CHECK ("key_backups"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "key_backup_until" CHECK ("key_backups"."retain_until" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "key_registry_control" (
	"singleton" integer PRIMARY KEY NOT NULL,
	"generation" integer NOT NULL,
	CONSTRAINT "key_registry_singleton" CHECK ("key_registry_control"."singleton" = 1),
	CONSTRAINT "key_registry_generation" CHECK ("key_registry_control"."generation" BETWEEN 1 AND 2147483647 AND cast("key_registry_control"."generation" as integer) = "key_registry_control"."generation")
);
--> statement-breakpoint
CREATE TABLE "key_versions" (
	"purpose" text NOT NULL,
	"key_id" text NOT NULL,
	"version" integer NOT NULL,
	"state" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "key_versions_purpose_key_id_version_pk" PRIMARY KEY("purpose","key_id","version"),
	CONSTRAINT "key_purpose" CHECK ("key_versions"."purpose" IN ('token-hmac','blind-index','envelope-kek')),
	CONSTRAINT "key_id_length" CHECK (length("key_versions"."key_id") BETWEEN 1 AND 64),
	CONSTRAINT "key_version" CHECK ("key_versions"."version" BETWEEN 1 AND 2147483647 AND cast("key_versions"."version" as integer) = "key_versions"."version"),
	CONSTRAINT "key_state" CHECK ("key_versions"."state" IN ('current','previous','revoked','removed')),
	CONSTRAINT "key_created" CHECK ("key_versions"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "protected_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"purpose" text NOT NULL,
	"key_id" text NOT NULL,
	"key_version" integer NOT NULL,
	"record" jsonb NOT NULL,
	CONSTRAINT "protected_record_id" CHECK (substr("protected_records"."id"::text,15,1) = '4' AND substr("protected_records"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "protected_record_revision" CHECK ("protected_records"."revision" BETWEEN 1 AND 2147483647 AND cast("protected_records"."revision" as integer) = "protected_records"."revision"),
	CONSTRAINT "protected_record_json" CHECK (length("protected_records"."record"::text) <= 65536),
	CONSTRAINT "protected_record_reference" CHECK (coalesce("protected_records"."record"->'key'->>'purpose' = "protected_records"."purpose" AND "protected_records"."record"->'key'->>'id' = "protected_records"."key_id" AND "protected_records"."record"->'key'->>'version' = cast("protected_records"."key_version" as text), false))
);
--> statement-breakpoint
ALTER TABLE "key_backup_references" ADD CONSTRAINT "key_backup_references_backup_id_key_backups_id_fk" FOREIGN KEY ("backup_id") REFERENCES "public"."key_backups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_backup_references" ADD CONSTRAINT "key_backup_reference_fk" FOREIGN KEY ("purpose","key_id","key_version") REFERENCES "public"."key_versions"("purpose","key_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protected_records" ADD CONSTRAINT "protected_record_key_fk" FOREIGN KEY ("purpose","key_id","key_version") REFERENCES "public"."key_versions"("purpose","key_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "key_backup_reference_key" ON "key_backup_references" USING btree ("purpose","key_id","key_version");--> statement-breakpoint
CREATE INDEX "key_backup_state_index" ON "key_backups" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "key_one_current" ON "key_versions" USING btree ("purpose") WHERE "key_versions"."state" = 'current';--> statement-breakpoint
CREATE INDEX "key_state_purpose" ON "key_versions" USING btree ("state","purpose");--> statement-breakpoint
CREATE INDEX "protected_record_key" ON "protected_records" USING btree ("purpose","key_id","key_version");
--> statement-breakpoint
INSERT INTO key_registry_control (singleton, generation) VALUES (1, 1);
--> statement-breakpoint
CREATE FUNCTION guard_key_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'key identities are permanent' USING ERRCODE = '23514';
  END IF;
  IF NEW.purpose != OLD.purpose OR NEW.key_id != OLD.key_id OR NEW.version != OLD.version OR NEW.created_at != OLD.created_at OR
    NOT (NEW.state = OLD.state OR (OLD.state = 'current' AND NEW.state IN ('previous','revoked')) OR (OLD.state = 'previous' AND NEW.state IN ('revoked','removed')) OR (OLD.state = 'revoked' AND NEW.state = 'removed')) OR
    (NEW.state = 'removed' AND (EXISTS (SELECT 1 FROM protected_records WHERE purpose = OLD.purpose AND key_id = OLD.key_id AND key_version = OLD.version) OR EXISTS (SELECT 1 FROM key_backup_references WHERE purpose = OLD.purpose AND key_id = OLD.key_id AND key_version = OLD.version))) THEN
    RAISE EXCEPTION 'invalid key lifecycle transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER key_versions_transition BEFORE UPDATE OR DELETE ON key_versions FOR EACH ROW EXECUTE FUNCTION guard_key_lifecycle();
--> statement-breakpoint
CREATE TRIGGER key_versions_no_truncate BEFORE TRUNCATE ON key_versions FOR EACH STATEMENT EXECUTE FUNCTION guard_key_lifecycle();
