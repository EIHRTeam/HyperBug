CREATE TRIGGER comment_history_no_mutation BEFORE UPDATE OR DELETE ON comment_history FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER comment_history_no_truncate BEFORE TRUNCATE ON comment_history FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER issue_form_versions_no_mutation BEFORE UPDATE OR DELETE ON issue_form_versions FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER issue_form_versions_no_truncate BEFORE TRUNCATE ON issue_form_versions FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
