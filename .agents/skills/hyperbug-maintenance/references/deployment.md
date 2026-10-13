# Deployment, release, and recovery

Read for packaging, rollout, rollback, backup/restore, secret rotation, and incidents. Module [13](../../../../docs/plan/modules/13-mvp-release-and-operations.md) owns release acceptance. Existing authorization determines whether this task prepares artifacts, uses staging, or changes production.

## Prepare the concrete operation

Identify environment, current/target version, artifacts, migrations, configuration, credentials source, expected checks, and stop/recovery criteria. Inspect live state when the task concerns a running deployment. Refresh provider/CLI documentation through root rules; do not turn a planned runbook command into an assumed installed tool.

Support both official profiles: Cloudflare-native and Node/PostgreSQL/S3 with Graphile Worker. Frontend and backend releases are independent. Keep runtime config public, static SPA fallbacks/cache rules valid, and CSP/CORS aligned with exact frontend/API/auth/media origins. Preview defaults to staging rather than wildcard access to production.

Only list a provider/version as tested when its compatibility suite has actually run. Workers + PostgreSQL/Hyperdrive and generic S3-compatible branding do not establish support by themselves.

## Release and rollback

Build from reviewed exact dependencies/frozen lockfile; retain artifact hashes and reproducible metadata, with provenance/signing where supported. Run relevant [acceptance checks](../../hyperbug-development/references/testing.md), migration/upgrade evidence, configuration validation, and secret/license/dependency checks.

Sequence database compatibility, backend/worker deployment, then independently configured frontend as the specific release requires. Define smoke checks and thresholds before rollout. On failure, stop the rollout and apply its recovery path; inspect ambiguous deployment state before retrying.

Roll back application artifacts only when compatible with the current schema. Use the [migration procedure](database-migrations.md) for forward fixes or coordinated restores. Do not claim publication from a prepared artifact, nor successful recovery from an unexercised runbook.

## Backup and restore

Back up database records, referenced blobs, non-secret configuration, and access to required encryption-key versions through appropriate secret management. Define a consistency point and retention policy; do not expose keys in ordinary backups/logs.

Rehearse restoration in an isolated authorized environment. Verify schema/application versions, counts and relationships, attachment readability, encrypted data, outbox/jobs, and search rebuild. Avoid replaying notifications/webhooks to real recipients during a restore drill. Record measured recovery duration/data loss rather than promising unmeasured recovery objectives.

## Secrets and incidents

For planned rotation, inventory key consumers and stored key IDs, introduce the new version, retain current/previous overlap as policy permits, migrate or rewrap retained data, and verify reads/writes before retirement. Include HMAC/token/blind-index/signing keys where affected. Never retire a key still needed by retained data or recoverable backups.

For confirmed compromise, follow explicit emergency revocation and containment; planned overlap must not keep a compromised credential trusted. Record affected scope and recovery evidence without logging secrets. Preserve relevant diagnostic/audit evidence under the retention policy.

During an outage, distinguish critical verification failures from non-critical provider effects. Keep authentication/authorization fail closed; recover queued effects with bounded retries, idempotency, and audited replay. Inspect DLQ growth, queue lag, expired leases, search drift, and attachment cleanup as relevant.

Update the maintenance reference/runbook only with verified commands and lessons, then complete the shared [session handoff](../../hyperbug-development/references/session-handoffs.md). Prepare reviewable output before seeking any actually missing authorization; a skill does not grant production access or permission to message others.

