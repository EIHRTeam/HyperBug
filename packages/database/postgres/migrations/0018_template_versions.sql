CREATE TABLE "issue_template_versions" (
	"project_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"enabled" integer NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "issue_template_versions_project_id_template_id_version_pk" PRIMARY KEY("project_id","template_id","version"),
	CONSTRAINT "template_version_bound" CHECK ("issue_template_versions"."version" BETWEEN 1 AND 2147483647 AND cast("issue_template_versions"."version" as integer) = "issue_template_versions"."version"),
	CONSTRAINT "template_version_enabled" CHECK ("issue_template_versions"."enabled" IN (0,1)),
	CONSTRAINT "template_version_name" CHECK (length("issue_template_versions"."name") BETWEEN 1 AND 100),
	CONSTRAINT "template_version_body" CHECK (length("issue_template_versions"."body") <= 32768),
	CONSTRAINT "template_version_created" CHECK ("issue_template_versions"."created_at" BETWEEN 0 AND 8640000000000000)
);
--> statement-breakpoint
ALTER TABLE "issue_template_versions" ADD CONSTRAINT "template_version_project_fk" FOREIGN KEY ("project_id","template_id") REFERENCES "public"."issue_templates"("project_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Legacy heads have no creation time/history. Zero is an explicit unknown-time sentinel.
INSERT INTO issue_template_versions (project_id, template_id, version, name, body, enabled, created_at)
SELECT project_id, id, revision, name, body, enabled, 0 FROM issue_templates;
--> statement-breakpoint
CREATE TRIGGER issue_template_versions_no_mutation BEFORE UPDATE OR DELETE ON issue_template_versions FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER issue_template_versions_no_truncate BEFORE TRUNCATE ON issue_template_versions FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER form_submissions_no_mutation BEFORE UPDATE OR DELETE ON form_submissions FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER form_submissions_no_truncate BEFORE TRUNCATE ON form_submissions FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
