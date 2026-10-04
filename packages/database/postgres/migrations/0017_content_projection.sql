ALTER TABLE "comments" ADD COLUMN "body_text" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "body_text_version" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "body_text" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "body_text_version" text;