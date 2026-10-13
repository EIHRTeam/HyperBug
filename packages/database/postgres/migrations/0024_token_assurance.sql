ALTER TABLE "authorization_sessions" ADD COLUMN "auth_method" text DEFAULT 'password' NOT NULL;--> statement-breakpoint
ALTER TABLE "authorization_sessions" ADD COLUMN "authenticated_at" bigint;--> statement-breakpoint
ALTER TABLE "authorization_sessions" ADD COLUMN "assurance" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD COLUMN "auth_method" text DEFAULT 'password' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD COLUMN "authenticated_at" bigint;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD COLUMN "assurance" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD COLUMN "auth_method" text DEFAULT 'password' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD COLUMN "authenticated_at" bigint;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD COLUMN "assurance" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "authorization_sessions" SET "authenticated_at" = "created_at" WHERE "authenticated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "authorization_sessions" ALTER COLUMN "authenticated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "authorization_sessions" ADD CONSTRAINT "auth_method_value" CHECK ("auth_method" IN ('password','passkey','recovery','bootstrap'));--> statement-breakpoint
ALTER TABLE "authorization_sessions" ADD CONSTRAINT "assurance_value" CHECK ("assurance" IN (1,2));--> statement-breakpoint
ALTER TABLE "authorization_sessions" ADD CONSTRAINT "assurance_time_order" CHECK ("authenticated_at" BETWEEN 0 AND "created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION authorization_sessions_assurance_immutable() RETURNS trigger AS $$
BEGIN
	IF NEW.auth_method <> OLD.auth_method OR NEW.authenticated_at <> OLD.authenticated_at OR NEW.assurance <> OLD.assurance THEN
		RAISE EXCEPTION 'Authentication assurance is immutable';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER authorization_sessions_assurance_update BEFORE UPDATE ON "authorization_sessions" FOR EACH ROW EXECUTE FUNCTION authorization_sessions_assurance_immutable();--> statement-breakpoint
UPDATE "oauth_codes" SET "authenticated_at" = "created_at" WHERE "authenticated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "oauth_codes" ALTER COLUMN "authenticated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "auth_method_value" CHECK ("auth_method" IN ('password','passkey','recovery','bootstrap'));--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "assurance_value" CHECK ("assurance" IN (1,2));--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "assurance_time_order" CHECK ("authenticated_at" BETWEEN 0 AND "created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION oauth_codes_assurance_immutable() RETURNS trigger AS $$
BEGIN
	IF NEW.auth_method <> OLD.auth_method OR NEW.authenticated_at <> OLD.authenticated_at OR NEW.assurance <> OLD.assurance THEN
		RAISE EXCEPTION 'Authentication assurance is immutable';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER oauth_codes_assurance_update BEFORE UPDATE ON "oauth_codes" FOR EACH ROW EXECUTE FUNCTION oauth_codes_assurance_immutable();--> statement-breakpoint
UPDATE "oauth_access_tokens" SET "authenticated_at" = "created_at" WHERE "authenticated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ALTER COLUMN "authenticated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "auth_method_value" CHECK ("auth_method" IN ('password','passkey','recovery','bootstrap'));--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "assurance_value" CHECK ("assurance" IN (1,2));--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "assurance_time_order" CHECK ("authenticated_at" BETWEEN 0 AND "created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION oauth_access_tokens_assurance_immutable() RETURNS trigger AS $$
BEGIN
	IF NEW.auth_method <> OLD.auth_method OR NEW.authenticated_at <> OLD.authenticated_at OR NEW.assurance <> OLD.assurance THEN
		RAISE EXCEPTION 'Authentication assurance is immutable';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER oauth_access_tokens_assurance_update BEFORE UPDATE ON "oauth_access_tokens" FOR EACH ROW EXECUTE FUNCTION oauth_access_tokens_assurance_immutable();--> statement-breakpoint
