CREATE TRIGGER comment_history_no_update BEFORE UPDATE ON comment_history BEGIN SELECT RAISE(ABORT, 'comment_history is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER comment_history_no_delete BEFORE DELETE ON comment_history BEGIN SELECT RAISE(ABORT, 'comment_history is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER comment_history_no_replace BEFORE INSERT ON comment_history WHEN EXISTS (SELECT 1 FROM comment_history WHERE id = NEW.id OR (comment_id = NEW.comment_id AND revision = NEW.revision)) BEGIN SELECT RAISE(ABORT, 'comment_history is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER issue_form_versions_no_update BEFORE UPDATE ON issue_form_versions BEGIN SELECT RAISE(ABORT, 'issue_form_versions is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER issue_form_versions_no_delete BEFORE DELETE ON issue_form_versions BEGIN SELECT RAISE(ABORT, 'issue_form_versions is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER issue_form_versions_no_replace BEFORE INSERT ON issue_form_versions WHEN EXISTS (SELECT 1 FROM issue_form_versions WHERE project_id = NEW.project_id AND form_id = NEW.form_id AND version = NEW.version) BEGIN SELECT RAISE(ABORT, 'issue_form_versions is append-only'); END;
