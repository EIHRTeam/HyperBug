CREATE TABLE `search_budget` (
	`id` integer PRIMARY KEY NOT NULL,
	`day` integer NOT NULL,
	`reads` integer NOT NULL,
	`writes` integer NOT NULL,
	CONSTRAINT "search_budget_singleton" CHECK("search_budget"."id" = 1),
	CONSTRAINT "search_budget_bounds" CHECK("search_budget"."day" >= 0 AND "search_budget"."reads" BETWEEN 0 AND 1000000 AND "search_budget"."writes" BETWEEN 0 AND 20000)
);
