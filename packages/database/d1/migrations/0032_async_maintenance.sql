CREATE TABLE `async_maintenance` (
	`name` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`temporary` text,
	`orphan` text,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "async_maintenance_name" CHECK("async_maintenance"."name" = 'uploads'),
	CONSTRAINT "async_maintenance_checkpoint" CHECK(("async_maintenance"."temporary" IS NULL OR length("async_maintenance"."temporary") <= 1024) AND ("async_maintenance"."orphan" IS NULL OR length("async_maintenance"."orphan") <= 1024)),
	CONSTRAINT "async_maintenance_time" CHECK("async_maintenance"."updated_at" IS NULL OR (typeof("async_maintenance"."updated_at") = 'integer' AND "async_maintenance"."updated_at" BETWEEN 0 AND 8640000000000000))
);
