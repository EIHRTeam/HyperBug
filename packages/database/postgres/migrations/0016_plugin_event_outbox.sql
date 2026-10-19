CREATE TABLE "plugin_event_outbox" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"plugin_id" text NOT NULL,
	"point" text NOT NULL,
	"payload_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	"available_at" bigint NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivered_at" bigint,
	CONSTRAINT "plugin_event_id_scope" CHECK (length("plugin_event_outbox"."plugin_id") BETWEEN 3 AND 128 AND "plugin_event_outbox"."plugin_id" LIKE '@%'),
	CONSTRAINT "plugin_event_point_bound" CHECK (length("plugin_event_outbox"."point") BETWEEN 3 AND 128),
	CONSTRAINT "plugin_event_attempts" CHECK ("plugin_event_outbox"."attempts" >= 0 AND "plugin_event_outbox"."attempts" <= 2147483647),
	CONSTRAINT "plugin_event_version" CHECK ("plugin_event_outbox"."payload_version" >= 1 AND "plugin_event_outbox"."payload_version" <= 2147483647),
	CONSTRAINT "plugin_event_payload" CHECK (length("plugin_event_outbox"."payload"::text) <= 65536),
	CONSTRAINT "plugin_event_created" CHECK ("plugin_event_outbox"."created_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "plugin_event_available" CHECK ("plugin_event_outbox"."available_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "plugin_event_delivered" CHECK ("plugin_event_outbox"."delivered_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "plugin_event_time_order" CHECK ("plugin_event_outbox"."available_at" >= "plugin_event_outbox"."created_at" AND ("plugin_event_outbox"."delivered_at" IS NULL OR "plugin_event_outbox"."delivered_at" >= "plugin_event_outbox"."created_at")),
	CONSTRAINT "plugin_event_id" CHECK (substr("plugin_event_outbox"."event_id"::text,15,1) = '4' AND substr("plugin_event_outbox"."event_id"::text,20,1) IN ('8','9','a','b'))
);
--> statement-breakpoint
CREATE INDEX "plugin_event_pending" ON "plugin_event_outbox" USING btree ("delivered_at","available_at","event_id");--> statement-breakpoint
CREATE INDEX "plugin_event_plugin" ON "plugin_event_outbox" USING btree ("plugin_id","created_at");