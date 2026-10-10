CREATE TABLE "rate_limit_counters" (
	"category" text NOT NULL,
	"dimension" text NOT NULL,
	"key_version" integer NOT NULL,
	"subject_digest" text NOT NULL,
	"window_start" bigint NOT NULL,
	"hits" integer NOT NULL,
	"expires_at" bigint NOT NULL,
	CONSTRAINT "rate_limit_counters_category_dimension_key_version_subject_digest_window_start_pk" PRIMARY KEY("category","dimension","key_version","subject_digest","window_start"),
	CONSTRAINT "rate_limit_category" CHECK ("rate_limit_counters"."category" IN ('login','password-reset','registration','issue-create','comment-create','reaction','search','attachment-upload','api-token-create','webhook-configure')),
	CONSTRAINT "rate_limit_dimension" CHECK ("rate_limit_counters"."dimension" IN ('ip','account','principal','project','token','route')),
	CONSTRAINT "rate_limit_key_version" CHECK ("rate_limit_counters"."key_version" BETWEEN 1 AND 2147483647),
	CONSTRAINT "rate_limit_digest" CHECK ("rate_limit_counters"."subject_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "rate_limit_hits" CHECK ("rate_limit_counters"."hits" BETWEEN 1 AND 2147483647),
	CONSTRAINT "rate_limit_expiry_order" CHECK ("rate_limit_counters"."expires_at" > "rate_limit_counters"."window_start"),
	CONSTRAINT "rate_limit_window_start" CHECK ("rate_limit_counters"."window_start" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "rate_limit_expires_at" CHECK ("rate_limit_counters"."expires_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_expiry" ON "rate_limit_counters" USING btree ("expires_at");