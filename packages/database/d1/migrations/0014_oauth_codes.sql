CREATE TABLE `oauth_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`digest` text NOT NULL,
	`client_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scope` text NOT NULL,
	`code_challenge` text NOT NULL,
	`principal_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "oauth_code_id" CHECK(length("oauth_codes"."id") = 36 AND "oauth_codes"."id" = lower("oauth_codes"."id") AND length(replace("oauth_codes"."id", '-', '')) = 32 AND replace("oauth_codes"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("oauth_codes"."id",9,1) = '-' AND substr("oauth_codes"."id",14,1) = '-' AND substr("oauth_codes"."id",19,1) = '-' AND substr("oauth_codes"."id",24,1) = '-' AND substr("oauth_codes"."id",15,1) = '4' AND substr("oauth_codes"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "oauth_code_client_bound" CHECK(length("oauth_codes"."client_id") BETWEEN 1 AND 128),
	CONSTRAINT "oauth_code_redirect_bound" CHECK(length("oauth_codes"."redirect_uri") BETWEEN 1 AND 2048),
	CONSTRAINT "oauth_code_scope_bound" CHECK(length("oauth_codes"."scope") BETWEEN 1 AND 256),
	CONSTRAINT "oauth_code_challenge_bound" CHECK(length("oauth_codes"."code_challenge") BETWEEN 43 AND 128),
	CONSTRAINT "oauth_code_digest" CHECK(json_valid("oauth_codes"."digest") AND length("oauth_codes"."digest") <= 65536),
	CONSTRAINT "oauth_code_created" CHECK("oauth_codes"."created_at" IS NULL OR (typeof("oauth_codes"."created_at") = 'integer' AND "oauth_codes"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "oauth_code_expires" CHECK("oauth_codes"."expires_at" IS NULL OR (typeof("oauth_codes"."expires_at") = 'integer' AND "oauth_codes"."expires_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "oauth_code_consumed" CHECK("oauth_codes"."consumed_at" IS NULL OR (typeof("oauth_codes"."consumed_at") = 'integer' AND "oauth_codes"."consumed_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "oauth_code_time_order" CHECK("oauth_codes"."expires_at" > "oauth_codes"."created_at" AND "oauth_codes"."expires_at" <= "oauth_codes"."created_at" + 60000 AND ("oauth_codes"."consumed_at" IS NULL OR "oauth_codes"."consumed_at" >= "oauth_codes"."created_at"))
);
--> statement-breakpoint
CREATE INDEX `oauth_code_expiry` ON `oauth_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `oauth_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`digest` text NOT NULL,
	`principal_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`client_id` text NOT NULL,
	`scope` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "oauth_token_id" CHECK(length("oauth_access_tokens"."id") = 36 AND "oauth_access_tokens"."id" = lower("oauth_access_tokens"."id") AND length(replace("oauth_access_tokens"."id", '-', '')) = 32 AND replace("oauth_access_tokens"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("oauth_access_tokens"."id",9,1) = '-' AND substr("oauth_access_tokens"."id",14,1) = '-' AND substr("oauth_access_tokens"."id",19,1) = '-' AND substr("oauth_access_tokens"."id",24,1) = '-' AND substr("oauth_access_tokens"."id",15,1) = '4' AND substr("oauth_access_tokens"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "oauth_token_client_bound" CHECK(length("oauth_access_tokens"."client_id") BETWEEN 1 AND 128),
	CONSTRAINT "oauth_token_scope_bound" CHECK(length("oauth_access_tokens"."scope") BETWEEN 1 AND 256),
	CONSTRAINT "oauth_token_digest" CHECK(json_valid("oauth_access_tokens"."digest") AND length("oauth_access_tokens"."digest") <= 65536),
	CONSTRAINT "oauth_token_created" CHECK("oauth_access_tokens"."created_at" IS NULL OR (typeof("oauth_access_tokens"."created_at") = 'integer' AND "oauth_access_tokens"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "oauth_token_expires" CHECK("oauth_access_tokens"."expires_at" IS NULL OR (typeof("oauth_access_tokens"."expires_at") = 'integer' AND "oauth_access_tokens"."expires_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "oauth_token_revoked" CHECK("oauth_access_tokens"."revoked_at" IS NULL OR (typeof("oauth_access_tokens"."revoked_at") = 'integer' AND "oauth_access_tokens"."revoked_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "oauth_token_time_order" CHECK("oauth_access_tokens"."expires_at" > "oauth_access_tokens"."created_at" AND "oauth_access_tokens"."expires_at" - "oauth_access_tokens"."created_at" BETWEEN 300000 AND 900000 AND ("oauth_access_tokens"."revoked_at" IS NULL OR "oauth_access_tokens"."revoked_at" >= "oauth_access_tokens"."created_at"))
);
--> statement-breakpoint
CREATE INDEX `oauth_access_token_principal` ON `oauth_access_tokens` (`principal_id`,`id`);--> statement-breakpoint
CREATE INDEX `oauth_access_token_expiry` ON `oauth_access_tokens` (`expires_at`);
