ALTER TABLE `authorization_sessions` ADD COLUMN `auth_method` text DEFAULT 'password' NOT NULL;
--> statement-breakpoint
ALTER TABLE `authorization_sessions` ADD COLUMN `authenticated_at` integer;
--> statement-breakpoint
ALTER TABLE `authorization_sessions` ADD COLUMN `assurance` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `oauth_codes` ADD COLUMN `auth_method` text DEFAULT 'password' NOT NULL;
--> statement-breakpoint
ALTER TABLE `oauth_codes` ADD COLUMN `authenticated_at` integer;
--> statement-breakpoint
ALTER TABLE `oauth_codes` ADD COLUMN `assurance` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `oauth_access_tokens` ADD COLUMN `auth_method` text DEFAULT 'password' NOT NULL;
--> statement-breakpoint
ALTER TABLE `oauth_access_tokens` ADD COLUMN `authenticated_at` integer;
--> statement-breakpoint
ALTER TABLE `oauth_access_tokens` ADD COLUMN `assurance` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE `authorization_sessions` SET `authenticated_at` = `created_at` WHERE `authenticated_at` IS NULL;
--> statement-breakpoint
UPDATE `oauth_codes` SET `authenticated_at` = `created_at` WHERE `authenticated_at` IS NULL;
--> statement-breakpoint
UPDATE `oauth_access_tokens` SET `authenticated_at` = `created_at` WHERE `authenticated_at` IS NULL;
--> statement-breakpoint
CREATE TRIGGER authorization_sessions_assurance_insert BEFORE INSERT ON authorization_sessions WHEN NEW.auth_method NOT IN ('password','passkey','recovery','bootstrap') OR NEW.assurance NOT IN (1,2) OR NEW.authenticated_at IS NULL OR typeof(NEW.authenticated_at) <> 'integer' OR NEW.authenticated_at < 0 OR NEW.authenticated_at > NEW.created_at BEGIN SELECT RAISE(ABORT, 'Invalid authentication assurance'); END;
--> statement-breakpoint
CREATE TRIGGER authorization_sessions_assurance_update BEFORE UPDATE ON authorization_sessions WHEN NEW.auth_method IS NOT OLD.auth_method OR NEW.authenticated_at IS NOT OLD.authenticated_at OR NEW.assurance IS NOT OLD.assurance BEGIN SELECT RAISE(ABORT, 'Authentication assurance is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER oauth_codes_assurance_insert BEFORE INSERT ON oauth_codes WHEN NEW.auth_method NOT IN ('password','passkey','recovery','bootstrap') OR NEW.assurance NOT IN (1,2) OR NEW.authenticated_at IS NULL OR typeof(NEW.authenticated_at) <> 'integer' OR NEW.authenticated_at < 0 OR NEW.authenticated_at > NEW.created_at BEGIN SELECT RAISE(ABORT, 'Invalid authentication assurance'); END;
--> statement-breakpoint
CREATE TRIGGER oauth_codes_assurance_update BEFORE UPDATE ON oauth_codes WHEN NEW.auth_method IS NOT OLD.auth_method OR NEW.authenticated_at IS NOT OLD.authenticated_at OR NEW.assurance IS NOT OLD.assurance BEGIN SELECT RAISE(ABORT, 'Authentication assurance is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER oauth_access_tokens_assurance_insert BEFORE INSERT ON oauth_access_tokens WHEN NEW.auth_method NOT IN ('password','passkey','recovery','bootstrap') OR NEW.assurance NOT IN (1,2) OR NEW.authenticated_at IS NULL OR typeof(NEW.authenticated_at) <> 'integer' OR NEW.authenticated_at < 0 OR NEW.authenticated_at > NEW.created_at BEGIN SELECT RAISE(ABORT, 'Invalid authentication assurance'); END;
--> statement-breakpoint
CREATE TRIGGER oauth_access_tokens_assurance_update BEFORE UPDATE ON oauth_access_tokens WHEN NEW.auth_method IS NOT OLD.auth_method OR NEW.authenticated_at IS NOT OLD.authenticated_at OR NEW.assurance IS NOT OLD.assurance BEGIN SELECT RAISE(ABORT, 'Authentication assurance is immutable'); END;
--> statement-breakpoint
