CREATE TABLE `authorization_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`credential_revision` integer NOT NULL,
	`digest` text NOT NULL,
	`created_at` integer NOT NULL,
	`idle_expires_at` integer NOT NULL,
	`absolute_expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "authorization_session_id" CHECK(length("authorization_sessions"."id") = 36 AND "authorization_sessions"."id" = lower("authorization_sessions"."id") AND length(replace("authorization_sessions"."id", '-', '')) = 32 AND replace("authorization_sessions"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("authorization_sessions"."id",9,1) = '-' AND substr("authorization_sessions"."id",14,1) = '-' AND substr("authorization_sessions"."id",19,1) = '-' AND substr("authorization_sessions"."id",24,1) = '-' AND substr("authorization_sessions"."id",15,1) = '4' AND substr("authorization_sessions"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "authorization_session_created" CHECK("authorization_sessions"."created_at" IS NULL OR (typeof("authorization_sessions"."created_at") = 'integer' AND "authorization_sessions"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "authorization_session_idle" CHECK("authorization_sessions"."idle_expires_at" IS NULL OR (typeof("authorization_sessions"."idle_expires_at") = 'integer' AND "authorization_sessions"."idle_expires_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "authorization_session_absolute" CHECK("authorization_sessions"."absolute_expires_at" IS NULL OR (typeof("authorization_sessions"."absolute_expires_at") = 'integer' AND "authorization_sessions"."absolute_expires_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "authorization_session_revoked" CHECK("authorization_sessions"."revoked_at" IS NULL OR (typeof("authorization_sessions"."revoked_at") = 'integer' AND "authorization_sessions"."revoked_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "authorization_session_digest" CHECK(json_valid("authorization_sessions"."digest") AND length("authorization_sessions"."digest") <= 65536),
	CONSTRAINT "authorization_session_revision" CHECK("authorization_sessions"."credential_revision" BETWEEN 1 AND 2147483647),
	CONSTRAINT "authorization_session_time_order" CHECK("authorization_sessions"."idle_expires_at" > "authorization_sessions"."created_at" AND "authorization_sessions"."absolute_expires_at" >= "authorization_sessions"."idle_expires_at" AND ("authorization_sessions"."revoked_at" IS NULL OR "authorization_sessions"."revoked_at" >= "authorization_sessions"."created_at"))
);
--> statement-breakpoint
CREATE INDEX `authorization_session_principal` ON `authorization_sessions` (`principal_id`,`id`);--> statement-breakpoint
CREATE INDEX `authorization_session_expiry` ON `authorization_sessions` (`absolute_expires_at`);