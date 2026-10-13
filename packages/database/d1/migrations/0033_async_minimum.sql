CREATE TABLE `async_minimum_budget` (
	`id` integer PRIMARY KEY NOT NULL,
	`day` integer NOT NULL,
	`reads` integer NOT NULL,
	`writes` integer NOT NULL,
	CONSTRAINT "async_minimum_budget_bounds" CHECK("async_minimum_budget"."id"=1 AND "async_minimum_budget"."day">=0 AND "async_minimum_budget"."reads" BETWEEN 0 AND 1500000 AND "async_minimum_budget"."writes" BETWEEN 0 AND 30000)
);
--> statement-breakpoint
CREATE TABLE `async_minimum_cursors` (
	`source` text PRIMARY KEY NOT NULL,
	`available_at` integer NOT NULL,
	`event_id` text NOT NULL,
	CONSTRAINT "async_minimum_cursor_source" CHECK("async_minimum_cursors"."source" IN ('core','plugin'))
);
