CREATE TABLE "search_documents" (
	"issue_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"projection_version" text,
	"active" integer DEFAULT 0 NOT NULL,
	"scope" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"title_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', title)) STORED NOT NULL,
	"body_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', body)) STORED NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', scope || ' ' || title || ' ' || body)) STORED NOT NULL,
	CONSTRAINT "search_issue" UNIQUE("issue_id"),
	CONSTRAINT "search_revision" CHECK ("search_documents"."revision" BETWEEN 1 AND 2147483647),
	CONSTRAINT "search_active" CHECK ("search_documents"."active" IN (0,1))
);
--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_issue_fk" FOREIGN KEY ("project_id","issue_id") REFERENCES "public"."issues"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_project_issue" ON "search_documents" USING btree ("project_id","issue_id");--> statement-breakpoint
CREATE INDEX "search_vector_gin" ON "search_documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "issue_project_author_created" ON "issues" USING btree ("project_id","author_id","created_at","id");