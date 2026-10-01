CREATE TABLE `plugin_event_outbox` (
	`event_id` text PRIMARY KEY NOT NULL,
	`plugin_id` text NOT NULL,
	`point` text NOT NULL,
	`payload_version` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`available_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`delivered_at` integer,
	CONSTRAINT "plugin_event_id_scope" CHECK(length("plugin_event_outbox"."plugin_id") BETWEEN 3 AND 128 AND "plugin_event_outbox"."plugin_id" LIKE '@%'),
	CONSTRAINT "plugin_event_point_bound" CHECK(length("plugin_event_outbox"."point") BETWEEN 3 AND 128),
	CONSTRAINT "plugin_event_attempts" CHECK("plugin_event_outbox"."attempts" >= 0 AND "plugin_event_outbox"."attempts" <= 2147483647),
	CONSTRAINT "plugin_event_version" CHECK("plugin_event_outbox"."payload_version" >= 1 AND "plugin_event_outbox"."payload_version" <= 2147483647),
	CONSTRAINT "plugin_event_payload" CHECK(json_valid("plugin_event_outbox"."payload") AND length("plugin_event_outbox"."payload") <= 65536),
	CONSTRAINT "plugin_event_created" CHECK("plugin_event_outbox"."created_at" IS NULL OR (typeof("plugin_event_outbox"."created_at") = 'integer' AND "plugin_event_outbox"."created_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "plugin_event_available" CHECK("plugin_event_outbox"."available_at" IS NULL OR (typeof("plugin_event_outbox"."available_at") = 'integer' AND "plugin_event_outbox"."available_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "plugin_event_delivered" CHECK("plugin_event_outbox"."delivered_at" IS NULL OR (typeof("plugin_event_outbox"."delivered_at") = 'integer' AND "plugin_event_outbox"."delivered_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "plugin_event_time_order" CHECK("plugin_event_outbox"."available_at" >= "plugin_event_outbox"."created_at" AND ("plugin_event_outbox"."delivered_at" IS NULL OR "plugin_event_outbox"."delivered_at" >= "plugin_event_outbox"."created_at")),
	CONSTRAINT "plugin_event_id" CHECK(length("plugin_event_outbox"."event_id") = 36 AND "plugin_event_outbox"."event_id" = lower("plugin_event_outbox"."event_id") AND length(replace("plugin_event_outbox"."event_id", '-', '')) = 32 AND replace("plugin_event_outbox"."event_id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("plugin_event_outbox"."event_id",9,1) = '-' AND substr("plugin_event_outbox"."event_id",14,1) = '-' AND substr("plugin_event_outbox"."event_id",19,1) = '-' AND substr("plugin_event_outbox"."event_id",24,1) = '-' AND substr("plugin_event_outbox"."event_id",15,1) = '4' AND substr("plugin_event_outbox"."event_id",20,1) IN ('8','9','a','b'))
);
--> statement-breakpoint
CREATE INDEX `plugin_event_pending` ON `plugin_event_outbox` (`delivered_at`,`available_at`,`event_id`);--> statement-breakpoint
CREATE INDEX `plugin_event_plugin` ON `plugin_event_outbox` (`plugin_id`,`created_at`);