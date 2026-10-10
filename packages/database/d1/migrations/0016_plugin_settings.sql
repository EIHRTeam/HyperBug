CREATE TABLE `plugin_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin_id` text NOT NULL,
	`setting_key` text NOT NULL,
	`kind` text NOT NULL,
	`public_value` text,
	`secret_record` text,
	`updated_at` integer NOT NULL,
	CONSTRAINT "plugin_setting_id" CHECK(length("plugin_settings"."id") = 36 AND "plugin_settings"."id" = lower("plugin_settings"."id") AND length(replace("plugin_settings"."id", '-', '')) = 32 AND replace("plugin_settings"."id", '-', '') NOT GLOB '*[^0-9a-f]*' AND substr("plugin_settings"."id",9,1) = '-' AND substr("plugin_settings"."id",14,1) = '-' AND substr("plugin_settings"."id",19,1) = '-' AND substr("plugin_settings"."id",24,1) = '-' AND substr("plugin_settings"."id",15,1) = '4' AND substr("plugin_settings"."id",20,1) IN ('8','9','a','b')),
	CONSTRAINT "plugin_settings_id" CHECK(length("plugin_settings"."plugin_id") BETWEEN 3 AND 128 AND "plugin_settings"."plugin_id" LIKE '@%' AND "plugin_settings"."plugin_id" NOT GLOB '*[^a-z0-9@/-]*' AND length("plugin_settings"."plugin_id") - length(replace("plugin_settings"."plugin_id", '/', '')) = 1),
	CONSTRAINT "plugin_settings_key" CHECK("plugin_settings"."setting_key" GLOB '[a-z]*' AND "plugin_settings"."setting_key" NOT GLOB '*[^a-z0-9-]*' AND length("plugin_settings"."setting_key") BETWEEN 1 AND 64),
	CONSTRAINT "plugin_settings_kind" CHECK("plugin_settings"."kind" IN ('public','secret')),
	CONSTRAINT "plugin_settings_shape" CHECK(("plugin_settings"."kind" = 'public' AND "plugin_settings"."public_value" IS NOT NULL AND "plugin_settings"."secret_record" IS NULL) OR ("plugin_settings"."kind" = 'secret' AND "plugin_settings"."public_value" IS NULL)),
	CONSTRAINT "plugin_settings_secret" CHECK(json_valid("plugin_settings"."secret_record") AND length("plugin_settings"."secret_record") <= 65536),
	CONSTRAINT "plugin_settings_updated" CHECK("plugin_settings"."updated_at" IS NULL OR (typeof("plugin_settings"."updated_at") = 'integer' AND "plugin_settings"."updated_at" BETWEEN 0 AND 8640000000000000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_setting_namespace` ON `plugin_settings` (`plugin_id`,`setting_key`);