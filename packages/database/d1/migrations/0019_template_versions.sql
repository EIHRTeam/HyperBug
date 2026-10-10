CREATE TABLE `issue_template_versions` (
	`project_id` text NOT NULL,
	`template_id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`enabled` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `template_id`, `version`),
	FOREIGN KEY (`project_id`,`template_id`) REFERENCES `issue_templates`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "template_version_bound" CHECK("issue_template_versions"."version" BETWEEN 1 AND 2147483647 AND cast("issue_template_versions"."version" as integer) = "issue_template_versions"."version"),
	CONSTRAINT "template_version_enabled" CHECK("issue_template_versions"."enabled" IN (0,1)),
	CONSTRAINT "template_version_name" CHECK(length("issue_template_versions"."name") BETWEEN 1 AND 100),
	CONSTRAINT "template_version_body" CHECK(length("issue_template_versions"."body") <= 32768),
	CONSTRAINT "template_version_created" CHECK("issue_template_versions"."created_at" IS NULL OR (typeof("issue_template_versions"."created_at") = 'integer' AND "issue_template_versions"."created_at" BETWEEN 0 AND 8640000000000000))
);

--> statement-breakpoint
-- Legacy heads have no creation time/history. Zero is an explicit unknown-time sentinel.
INSERT INTO issue_template_versions (project_id, template_id, version, name, body, enabled, created_at)
SELECT project_id, id, revision, name, body, enabled, 0 FROM issue_templates;
--> statement-breakpoint
CREATE TRIGGER issue_template_versions_no_update BEFORE UPDATE ON issue_template_versions BEGIN SELECT RAISE(ABORT, 'issue_template_versions is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER issue_template_versions_no_delete BEFORE DELETE ON issue_template_versions BEGIN SELECT RAISE(ABORT, 'issue_template_versions is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER issue_template_versions_no_replace BEFORE INSERT ON issue_template_versions WHEN EXISTS (SELECT 1 FROM issue_template_versions WHERE project_id = NEW.project_id AND template_id = NEW.template_id AND version = NEW.version) BEGIN SELECT RAISE(ABORT, 'issue_template_versions is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER form_submissions_no_update BEFORE UPDATE ON form_submissions BEGIN SELECT RAISE(ABORT, 'form_submissions is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER form_submissions_no_delete BEFORE DELETE ON form_submissions BEGIN SELECT RAISE(ABORT, 'form_submissions is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER form_submissions_no_replace BEFORE INSERT ON form_submissions WHEN EXISTS (SELECT 1 FROM form_submissions WHERE project_id = NEW.project_id AND issue_id = NEW.issue_id) BEGIN SELECT RAISE(ABORT, 'form_submissions is append-only'); END;
