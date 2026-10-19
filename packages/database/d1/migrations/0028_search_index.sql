CREATE TABLE `search_documents` (
	`rowid` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` text NOT NULL,
	`project_id` text NOT NULL,
	`revision` integer NOT NULL,
	`projection_version` text,
	`active` integer DEFAULT 0 NOT NULL,
	`scope` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`project_id`,`issue_id`) REFERENCES `issues`(`project_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "search_revision" CHECK("search_documents"."revision" BETWEEN 1 AND 2147483647),
	CONSTRAINT "search_active" CHECK("search_documents"."active" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `search_project_issue` ON `search_documents` (`project_id`,`issue_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `search_issue` ON `search_documents` (`issue_id`);--> statement-breakpoint
CREATE INDEX `issue_project_author_created` ON `issues` (`project_id`,`author_id`,`created_at`,`id`);
--> statement-breakpoint
-- FTS5 is not represented by Drizzle's schema generator; additive derived-only DDL.
CREATE VIRTUAL TABLE issue_search_fts USING fts5(scope, title, body, content='search_documents', content_rowid='rowid', tokenize='unicode61 remove_diacritics 0');
--> statement-breakpoint
CREATE TRIGGER search_documents_insert AFTER INSERT ON search_documents BEGIN
  INSERT INTO issue_search_fts(rowid, scope, title, body) VALUES (new.rowid, new.scope, new.title, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER search_documents_delete AFTER DELETE ON search_documents BEGIN
  INSERT INTO issue_search_fts(issue_search_fts, rowid, scope, title, body) VALUES ('delete', old.rowid, old.scope, old.title, old.body);
END;
--> statement-breakpoint
CREATE TRIGGER search_documents_update AFTER UPDATE ON search_documents BEGIN
  INSERT INTO issue_search_fts(issue_search_fts, rowid, scope, title, body) VALUES ('delete', old.rowid, old.scope, old.title, old.body);
  INSERT INTO issue_search_fts(rowid, scope, title, body) VALUES (new.rowid, new.scope, new.title, new.body);
END;
