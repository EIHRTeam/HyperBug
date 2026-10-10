CREATE TABLE "plugin_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plugin_id" text NOT NULL,
	"setting_key" text NOT NULL,
	"kind" text NOT NULL,
	"public_value" text,
	"secret_record" jsonb,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "plugin_setting_id" CHECK (substr("plugin_settings"."id"::text,15,1) = '4' AND substr("plugin_settings"."id"::text,20,1) IN ('8','9','a','b')),
	CONSTRAINT "plugin_settings_id" CHECK ("plugin_settings"."plugin_id" ~ '^@[a-z0-9][a-z0-9-]{0,62}/[a-z0-9][a-z0-9-]{0,62}$'),
	CONSTRAINT "plugin_settings_key" CHECK ("plugin_settings"."setting_key" ~ '^[a-z][a-z0-9-]{0,63}$'),
	CONSTRAINT "plugin_settings_kind" CHECK ("plugin_settings"."kind" IN ('public','secret')),
	CONSTRAINT "plugin_settings_shape" CHECK ((("plugin_settings"."kind" = 'public' AND "plugin_settings"."public_value" IS NOT NULL AND "plugin_settings"."secret_record" IS NULL) OR ("plugin_settings"."kind" = 'secret' AND "plugin_settings"."public_value" IS NULL))),
	CONSTRAINT "plugin_settings_secret" CHECK (length("plugin_settings"."secret_record"::text) <= 65536),
	CONSTRAINT "plugin_settings_updated" CHECK ("plugin_settings"."updated_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_setting_namespace" ON "plugin_settings" USING btree ("plugin_id","setting_key");