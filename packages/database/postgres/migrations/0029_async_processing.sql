CREATE TABLE "async_deliveries" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_id" uuid NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"publication_attempts" integer DEFAULT 0 NOT NULL,
	"available_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"publish_token" text,
	"publish_until" bigint DEFAULT 0 NOT NULL,
	"work_token" text,
	"work_until" bigint DEFAULT 0 NOT NULL,
	"failure" text,
	CONSTRAINT "async_source_event" UNIQUE("source","event_id"),
	CONSTRAINT "async_source" CHECK ("async_deliveries"."source" IN ('core','plugin')),
	CONSTRAINT "async_state" CHECK ("async_deliveries"."state" IN ('pending','done','failed')),
	CONSTRAINT "async_attempts" CHECK ("async_deliveries"."attempts" BETWEEN 0 AND 5 AND "async_deliveries"."publication_attempts" BETWEEN 0 AND 5),
	CONSTRAINT "async_failure" CHECK ("async_deliveries"."failure" IS NULL OR "async_deliveries"."failure" IN ('invalid','unsupported','permanent','transient','timeout','lease-exhausted')),
	CONSTRAINT "async_event_id" CHECK (substr("async_deliveries"."event_id"::text,15,1) = '4' AND substr("async_deliveries"."event_id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "async_created" CHECK ("async_deliveries"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "async_available" CHECK ("async_deliveries"."available_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "async_updated" CHECK ("async_deliveries"."updated_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "async_job_steps" (
	"job_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"committed_at" bigint NOT NULL,
	CONSTRAINT "async_job_steps_job_id_step_pk" PRIMARY KEY("job_id","step"),
	CONSTRAINT "async_step_bound" CHECK ("async_job_steps"."step" BETWEEN 0 AND 15),
	CONSTRAINT "async_step_time" CHECK ("async_job_steps"."committed_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE TABLE "async_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'conformance' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"checkpoint" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_steps" integer NOT NULL,
	"result_reference" text,
	"lease_token" text,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "async_job_status" CHECK ("async_jobs"."status" IN ('pending','running','completed','failed','cancelled')),
	CONSTRAINT "async_job_kind" CHECK ("async_jobs"."kind" = 'conformance'),
	CONSTRAINT "async_job_bounds" CHECK ("async_jobs"."max_steps" BETWEEN 1 AND 16 AND "async_jobs"."checkpoint" BETWEEN 0 AND "async_jobs"."max_steps" AND "async_jobs"."progress" BETWEEN 0 AND 100 AND "async_jobs"."attempts" BETWEEN 0 AND 5),
	CONSTRAINT "async_job_result_bound" CHECK ("async_jobs"."result_reference" IS NULL OR length("async_jobs"."result_reference") <= 512),
	CONSTRAINT "async_job_id" CHECK (substr("async_jobs"."id"::text,15,1) = '4' AND substr("async_jobs"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "async_job_updated" CHECK ("async_jobs"."updated_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "async_job_created" CHECK ("async_jobs"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
ALTER TABLE "async_job_steps" ADD CONSTRAINT "async_job_steps_job_id_async_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."async_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "async_pending" ON "async_deliveries" USING btree ("state","available_at","delivery_id");--> statement-breakpoint
CREATE INDEX "async_terminal" ON "async_deliveries" USING btree ("state","updated_at","delivery_id");--> statement-breakpoint
CREATE INDEX "async_job_pending" ON "async_jobs" USING btree ("status","lease_until","id");