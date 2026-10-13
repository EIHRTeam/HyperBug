-- Migration owners can deliberately change policy; application DML cannot.
CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'history is append-only' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_mutation BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER timeline_events_no_mutation BEFORE UPDATE OR DELETE ON timeline_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER timeline_events_no_truncate BEFORE TRUNCATE ON timeline_events FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
