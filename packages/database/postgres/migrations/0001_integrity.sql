ALTER TABLE "issues" DROP CONSTRAINT "issue_state_consistency";--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_id" CHECK (substr("audit_events"."id"::text,15,1) = '4' AND substr("audit_events"."id"::text,20,1) IN ('8','9','a','b'));--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_request_id" CHECK (substr("audit_events"."request_id"::text,15,1) = '4' AND substr("audit_events"."request_id"::text,20,1) IN ('8','9','a','b'));--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_created" CHECK ("audit_events"."created_at" BETWEEN 0 AND 8640000000000000);--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issue_closed" CHECK ("issues"."closed_at" BETWEEN 0 AND 8640000000000000);--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issue_state_consistency" CHECK (("issues"."state" = 'open' AND "issues"."close_reason" IS NULL AND "issues"."closed_at" IS NULL) OR ("issues"."state" = 'closed' AND "issues"."close_reason" IS NOT NULL AND "issues"."close_reason" IN ('completed','not_planned','duplicate','invalid','cannot_reproduce') AND "issues"."closed_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "receipt_id" CHECK (substr("mutation_receipts"."id"::text,15,1) = '4' AND substr("mutation_receipts"."id"::text,20,1) IN ('8','9','a','b'));--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "receipt_created" CHECK ("mutation_receipts"."created_at" BETWEEN 0 AND 8640000000000000);--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "receipt_expires" CHECK ("mutation_receipts"."expires_at" BETWEEN 0 AND 8640000000000000);--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_id" CHECK (substr("outbox"."id"::text,15,1) = '4' AND substr("outbox"."id"::text,20,1) IN ('8','9','a','b'));--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_aggregate_id" CHECK (substr("outbox"."aggregate_id"::text,15,1) = '4' AND substr("outbox"."aggregate_id"::text,20,1) IN ('8','9','a','b'));--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_created" CHECK ("outbox"."created_at" BETWEEN 0 AND 8640000000000000);--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_available" CHECK ("outbox"."available_at" BETWEEN 0 AND 8640000000000000);--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_delivered" CHECK ("outbox"."delivered_at" BETWEEN 0 AND 8640000000000000);--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_id" CHECK (substr("timeline_events"."id"::text,15,1) = '4' AND substr("timeline_events"."id"::text,20,1) IN ('8','9','a','b'));--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_created" CHECK ("timeline_events"."created_at" BETWEEN 0 AND 8640000000000000);