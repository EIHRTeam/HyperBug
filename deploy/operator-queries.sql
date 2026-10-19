-- Read-only operator queries. Run against the selected primary with read-only access.
-- Counts saturate to bound diagnostics; 1001 means a lower bound, not an exact total.
SELECT count(*) AS pending_lower_bound FROM (SELECT id FROM outbox WHERE delivered_at IS NULL LIMIT 1001) pending;
SELECT min(created_at) AS oldest_pending_at FROM outbox WHERE delivered_at IS NULL;
SELECT purpose, key_id, version, state FROM key_versions ORDER BY purpose, key_id, version LIMIT 33;
SELECT id, state, retain_until FROM key_backups ORDER BY retain_until, id LIMIT 100;
