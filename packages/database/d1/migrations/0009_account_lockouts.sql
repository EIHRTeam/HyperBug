CREATE TABLE `account_lockouts` (
	`key_version` integer NOT NULL,
	`subject_digest` text NOT NULL,
	`failed_attempts` integer NOT NULL,
	`not_before` integer NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`key_version`, `subject_digest`),
	CONSTRAINT "account_lockout_key_version" CHECK("account_lockouts"."key_version" BETWEEN 1 AND 2147483647),
	CONSTRAINT "account_lockout_digest" CHECK(length("account_lockouts"."subject_digest") = 64 AND "account_lockouts"."subject_digest" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "account_lockout_failures" CHECK("account_lockouts"."failed_attempts" BETWEEN 1 AND 2147483647),
	CONSTRAINT "account_lockout_time_order" CHECK("account_lockouts"."expires_at" >= "account_lockouts"."not_before"),
	CONSTRAINT "account_lockout_not_before" CHECK("account_lockouts"."not_before" IS NULL OR (typeof("account_lockouts"."not_before") = 'integer' AND "account_lockouts"."not_before" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "account_lockout_expires_at" CHECK("account_lockouts"."expires_at" IS NULL OR (typeof("account_lockouts"."expires_at") = 'integer' AND "account_lockouts"."expires_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE INDEX `account_lockout_expiry` ON `account_lockouts` (`expires_at`);