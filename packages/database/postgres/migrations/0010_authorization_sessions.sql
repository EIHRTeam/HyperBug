CREATE TABLE "authorization_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"principal_id" uuid NOT NULL,
	"identity_id" uuid NOT NULL,
	"credential_revision" integer NOT NULL,
	"digest" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	"idle_expires_at" bigint NOT NULL,
	"absolute_expires_at" bigint NOT NULL,
	"revoked_at" bigint,
	CONSTRAINT "authorization_session_id" CHECK (substr("authorization_sessions"."id"::text,15,1) = '4' AND substr("authorization_sessions"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "authorization_session_created" CHECK ("authorization_sessions"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "authorization_session_idle" CHECK ("authorization_sessions"."idle_expires_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "authorization_session_absolute" CHECK ("authorization_sessions"."absolute_expires_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "authorization_session_revision" CHECK ("authorization_sessions"."credential_revision" BETWEEN 1 AND 2147483647),
	CONSTRAINT "authorization_session_time_order" CHECK ("authorization_sessions"."idle_expires_at" > "authorization_sessions"."created_at" AND "authorization_sessions"."absolute_expires_at" >= "authorization_sessions"."idle_expires_at" AND ("authorization_sessions"."revoked_at" IS NULL OR "authorization_sessions"."revoked_at" >= "authorization_sessions"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "authorization_sessions" ADD CONSTRAINT "authorization_sessions_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorization_sessions" ADD CONSTRAINT "authorization_sessions_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authorization_session_principal" ON "authorization_sessions" USING btree ("principal_id","id");--> statement-breakpoint
CREATE INDEX "authorization_session_expiry" ON "authorization_sessions" USING btree ("absolute_expires_at");