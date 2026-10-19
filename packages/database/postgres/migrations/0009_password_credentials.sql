CREATE TABLE "password_credentials" (
	"identity_id" uuid PRIMARY KEY NOT NULL,
	"record" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "password_credential_record" CHECK (length("password_credentials"."record"::text) <= 65536),
	CONSTRAINT "password_credential_revision" CHECK ("password_credentials"."revision" BETWEEN 1 AND 2147483647 AND cast("password_credentials"."revision" as integer) = "password_credentials"."revision"),
	CONSTRAINT "password_credential_created" CHECK ("password_credentials"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "password_credential_updated" CHECK ("password_credentials"."updated_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "password_credential_time_order" CHECK ("password_credentials"."updated_at" >= "password_credentials"."created_at")
);
--> statement-breakpoint
ALTER TABLE "password_credentials" ADD CONSTRAINT "password_credentials_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE no action ON UPDATE no action;