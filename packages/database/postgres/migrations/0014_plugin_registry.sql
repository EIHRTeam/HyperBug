CREATE TABLE "plugin_registry" (
	"id" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"state" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"registered_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "plugin_registry_id" CHECK ("plugin_registry"."id" ~ '^@[a-z0-9][a-z0-9-]{0,62}/[a-z0-9][a-z0-9-]{0,62}$'),
	CONSTRAINT "plugin_registry_version" CHECK (length("plugin_registry"."version") BETWEEN 5 AND 64),
	CONSTRAINT "plugin_registry_state" CHECK ("plugin_registry"."state" IN ('registered','enabled','disabled')),
	CONSTRAINT "plugin_registry_manifest" CHECK (length("plugin_registry"."manifest"::text) <= 65536),
	CONSTRAINT "plugin_registry_registered" CHECK ("plugin_registry"."registered_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "plugin_registry_updated" CHECK ("plugin_registry"."updated_at" BETWEEN 0 AND 8640000000000000),
	CONSTRAINT "plugin_registry_time_order" CHECK ("plugin_registry"."updated_at" >= "plugin_registry"."registered_at")
);
