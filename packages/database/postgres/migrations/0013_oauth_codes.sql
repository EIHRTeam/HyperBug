CREATE TABLE "oauth_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"digest" jsonb NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text NOT NULL,
	"code_challenge" text NOT NULL,
	"principal_id" uuid NOT NULL,
	"identity_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"consumed_at" bigint,
	CONSTRAINT "oauth_code_id" CHECK (substr("oauth_codes"."id"::text,15,1) = '4' AND substr("oauth_codes"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "oauth_code_client_bound" CHECK (length("oauth_codes"."client_id") BETWEEN 1 AND 128),
	CONSTRAINT "oauth_code_redirect_bound" CHECK (length("oauth_codes"."redirect_uri") BETWEEN 1 AND 2048),
	CONSTRAINT "oauth_code_scope_bound" CHECK (length("oauth_codes"."scope") BETWEEN 1 AND 256),
	CONSTRAINT "oauth_code_challenge_bound" CHECK (length("oauth_codes"."code_challenge") BETWEEN 43 AND 128),
	CONSTRAINT "oauth_code_created" CHECK ("oauth_codes"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "oauth_code_expires" CHECK ("oauth_codes"."expires_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "oauth_code_consumed" CHECK ("oauth_codes"."consumed_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "oauth_code_time_order" CHECK ("oauth_codes"."expires_at" > "oauth_codes"."created_at" AND "oauth_codes"."expires_at" <= "oauth_codes"."created_at" + 60000 AND ("oauth_codes"."consumed_at" IS NULL OR "oauth_codes"."consumed_at" >= "oauth_codes"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_code_expiry" ON "oauth_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"digest" jsonb NOT NULL,
	"principal_id" uuid NOT NULL,
	"identity_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"scope" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"revoked_at" bigint,
	CONSTRAINT "oauth_token_id" CHECK (substr("oauth_access_tokens"."id"::text,15,1) = '4' AND substr("oauth_access_tokens"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "oauth_token_client_bound" CHECK (length("oauth_access_tokens"."client_id") BETWEEN 1 AND 128),
	CONSTRAINT "oauth_token_scope_bound" CHECK (length("oauth_access_tokens"."scope") BETWEEN 1 AND 256),
	CONSTRAINT "oauth_token_created" CHECK ("oauth_access_tokens"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "oauth_token_expires" CHECK ("oauth_access_tokens"."expires_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "oauth_token_revoked" CHECK ("oauth_access_tokens"."revoked_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "oauth_token_time_order" CHECK ("oauth_access_tokens"."expires_at" > "oauth_access_tokens"."created_at" AND "oauth_access_tokens"."expires_at" - "oauth_access_tokens"."created_at" BETWEEN 300000 AND 900000 AND ("oauth_access_tokens"."revoked_at" IS NULL OR "oauth_access_tokens"."revoked_at" >= "oauth_access_tokens"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_principal_id_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_access_token_principal" ON "oauth_access_tokens" USING btree ("principal_id","id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_expiry" ON "oauth_access_tokens" USING btree ("expires_at");
