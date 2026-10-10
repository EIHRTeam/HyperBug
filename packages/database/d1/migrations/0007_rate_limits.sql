CREATE TABLE `rate_limit_counters` (
	`category` text NOT NULL,
	`dimension` text NOT NULL,
	`key_version` integer NOT NULL,
	`subject_digest` text NOT NULL,
	`window_start` integer NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`category`, `dimension`, `key_version`, `subject_digest`, `window_start`),
	CONSTRAINT "rate_limit_category" CHECK("rate_limit_counters"."category" IN ('login','password-reset','registration','issue-create','comment-create','reaction','search','attachment-upload','api-token-create','webhook-configure')),
	CONSTRAINT "rate_limit_dimension" CHECK("rate_limit_counters"."dimension" IN ('ip','account','principal','project','token','route')),
	CONSTRAINT "rate_limit_key_version" CHECK("rate_limit_counters"."key_version" BETWEEN 1 AND 2147483647),
	CONSTRAINT "rate_limit_digest" CHECK(length("rate_limit_counters"."subject_digest") = 64 AND "rate_limit_counters"."subject_digest" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "rate_limit_hits" CHECK("rate_limit_counters"."hits" BETWEEN 1 AND 2147483647),
	CONSTRAINT "rate_limit_expiry_order" CHECK("rate_limit_counters"."expires_at" > "rate_limit_counters"."window_start"),
	CONSTRAINT "rate_limit_window_start" CHECK("rate_limit_counters"."window_start" IS NULL OR (typeof("rate_limit_counters"."window_start") = 'integer' AND "rate_limit_counters"."window_start" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "rate_limit_expires_at" CHECK("rate_limit_counters"."expires_at" IS NULL OR (typeof("rate_limit_counters"."expires_at") = 'integer' AND "rate_limit_counters"."expires_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE INDEX `rate_limit_expiry` ON `rate_limit_counters` (`expires_at`);