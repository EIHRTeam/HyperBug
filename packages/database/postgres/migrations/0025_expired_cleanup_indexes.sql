CREATE INDEX "authorization_session_idle_expiry" ON "authorization_sessions" USING btree ("idle_expires_at","id");
--> statement-breakpoint
CREATE INDEX "authorization_session_revoked_expiry" ON "authorization_sessions" USING btree ("revoked_at","id");
