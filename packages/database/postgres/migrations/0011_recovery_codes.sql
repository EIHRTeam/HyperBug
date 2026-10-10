CREATE TABLE "recovery_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identity_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"digest" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	"used_at" bigint,
	CONSTRAINT "recovery_code_id" CHECK (substr("recovery_codes"."id"::text,15,1) = '4' AND substr("recovery_codes"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "recovery_code_created" CHECK ("recovery_codes"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "recovery_code_used" CHECK ("recovery_codes"."used_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "recovery_code_generation" CHECK ("recovery_codes"."generation" BETWEEN 1 AND 2147483647),
	CONSTRAINT "recovery_code_time_order" CHECK ("recovery_codes"."used_at" IS NULL OR "recovery_codes"."used_at" >= "recovery_codes"."created_at")
);
--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recovery_code_identity" ON "recovery_codes" USING btree ("identity_id","generation");