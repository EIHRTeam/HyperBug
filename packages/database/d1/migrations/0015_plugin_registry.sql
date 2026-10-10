CREATE TABLE `plugin_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`state` text NOT NULL,
	`manifest` text NOT NULL,
	`registered_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "plugin_registry_id" CHECK(length("plugin_registry"."id") BETWEEN 3 AND 128 AND "plugin_registry"."id" LIKE '@%' AND "plugin_registry"."id" NOT GLOB '*[^a-z0-9@/-]*' AND length("plugin_registry"."id") - length(replace("plugin_registry"."id", '/', '')) = 1),
	CONSTRAINT "plugin_registry_version" CHECK(length("plugin_registry"."version") BETWEEN 5 AND 64),
	CONSTRAINT "plugin_registry_state" CHECK("plugin_registry"."state" IN ('registered','enabled','disabled')),
	CONSTRAINT "plugin_registry_manifest" CHECK(json_valid("plugin_registry"."manifest") AND length("plugin_registry"."manifest") <= 65536),
	CONSTRAINT "plugin_registry_registered" CHECK("plugin_registry"."registered_at" IS NULL OR (typeof("plugin_registry"."registered_at") = 'integer' AND "plugin_registry"."registered_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "plugin_registry_updated" CHECK("plugin_registry"."updated_at" IS NULL OR (typeof("plugin_registry"."updated_at") = 'integer' AND "plugin_registry"."updated_at" BETWEEN 0 AND 8640000000000000)),
	CONSTRAINT "plugin_registry_time_order" CHECK("plugin_registry"."updated_at" >= "plugin_registry"."registered_at")
);
