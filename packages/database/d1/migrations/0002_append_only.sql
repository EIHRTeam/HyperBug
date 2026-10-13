-- Ordinary application operations cannot rewrite audit or timeline history.
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
--> statement-breakpoint
-- INSERT OR REPLACE can bypass DELETE triggers when recursive_triggers is off.
CREATE TRIGGER audit_events_no_replace BEFORE INSERT ON audit_events WHEN EXISTS (SELECT 1 FROM audit_events WHERE id = NEW.id) BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER timeline_events_no_update BEFORE UPDATE ON timeline_events BEGIN SELECT RAISE(ABORT, 'timeline_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER timeline_events_no_delete BEFORE DELETE ON timeline_events BEGIN SELECT RAISE(ABORT, 'timeline_events is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER timeline_events_no_replace BEFORE INSERT ON timeline_events WHEN EXISTS (SELECT 1 FROM timeline_events WHERE id = NEW.id OR (issue_id = NEW.issue_id AND aggregate_revision = NEW.aggregate_revision)) BEGIN SELECT RAISE(ABORT, 'timeline_events is append-only'); END;
