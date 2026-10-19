# Install the self-hosted profile

[Documentation home](../index.md) · [Compatibility matrix](deployment.md) · [Operations](operations.md)

The tested local combination is Node 24.21.0, PostgreSQL 18.6, SeaweedFS 4.48 and the exact locked Graphile Worker dependency. This is unpublished release preparation; production TLS/proxy and deployment acceptance remain separate.

## Prepare the frozen artifact

From the repository root, use `corepack pnpm install --frozen-lockfile`, then `corepack pnpm build`. Run `node dist/node/index.mjs` with its pinned workspace dependencies and static assets retained. The JS file alone is not a complete distribution. See `deploy/node/README.md` for the input map; no Redis, RabbitMQ or separate worker-only CLI is required.

Supply explicit `HYPERBUG_ENV` and exact HTTPS `ALLOWED_ORIGINS`. Check the public template with `node tooling/check-deployment.ts node deploy/node/public-policy.example.json`. The JSON example is public policy, not an automatic environment loader; inject the settings with your process manager and replace example domains. Invalid policy refuses startup. No key/provider readiness is inferred from an offline check.

## Database, keys and administrator

Use either verified-TLS `HYPERBUG_DATABASE_URL`, or absolute `HYPERBUG_DATABASE_SOCKET_DIR` plus `HYPERBUG_DATABASE_NAME` and `HYPERBUG_DATABASE_USER`. A separately supplied migration-owner `HYPERBUG_MIGRATION_DATABASE_URL` enables `node tooling/migrate-postgres.ts --status` and `--apply`. Never put connection credentials in arguments or Git. Applied histories are immutable; failed migration statements/history roll back together.

Generate private files with `node tooling/provision-operator-files.ts /absolute/new/private/directory`. Mount the owned 0400/0600 files as `HYPERBUG_KEY_FILE`, `HYPERBUG_ABUSE_KEY_FILE` and initial `HYPERBUG_BOOTSTRAP_FILE`. Activate generated public references through the audited operator registry command described in [operations](operations.md), then use the first-party bootstrap enrollment endpoint. No secret is printed by provisioning. Enroll a passkey, keep recovery codes offline, and remove the enrollment mount after success. Password login alone cannot perform sensitive instance administration.

Register public client `hyperbug-web` with exact frontend `/oauth/callback` and `public-api` scope. Configure complete `PASSKEY_RP_ID`, `PASSKEY_RP_NAME`, `PASSKEY_ORIGIN`. No client secret exists. Native plugins are trusted backend code and require review; they cannot weaken Core policy or load arbitrary runtime scripts into the SPA.

## Storage and network boundaries

Mount optional `HYPERBUG_UPLOAD_STORAGE_FILE` with backend-only endpoint, bucket, region, `forcePathStyle` and credentials. Nonlocal storage uses HTTPS. SeaweedFS 4.48 is the tested S3 implementation; do not infer support for another provider/version. Prepare exact upload CORS, isolated `HYPERBUG_MEDIA_ORIGIN` and trusted scanning before releasing files. Without uploads, omit the storage mount; partial/invalid configuration fails closed.

Bind Node to loopback with explicit `HOST`/`PORT`, behind a verified TLS terminator, or configure its existing private native `HYPERBUG_TLS_FILE`. Remote media currently requires native Node TLS even behind a proxy. Check certificate/hostname, HSTS, direct-listener isolation, body/time limits and client-IP provenance at the chosen terminator. Node uses the native peer and ignores untrusted forwarded headers; a reverse proxy is not automatically verified real-client admission. There is no tested production reverse-proxy package in this local evidence.

## Processes, shutdown and recovery

API and Graphile tasks run in the same process. It initializes Graphile's schema with the selected pool; separate least-privilege worker-role deployment has not been certified. SIGTERM/SIGINT close uploads and HTTP, wait for active dispatch, stop the Graphile runner, release utilities and end the pool. Give shutdown a measured grace period before force-killing. Durable pending sources/checkpoints reconcile after restart; external side effects still need idempotency.

Check `/health/live` and `/health/ready`; readiness is only a prerequisite probe, so also exercise an authenticated allowed/denied action, safe Issue read, an outbox effect and attachment status. Stop on missing keys, primary/audit failure or integrity mismatch. [Operations](operations.md) separates compatible application rollback from forward migration/restore, coordinates database/blobs/config/key versions and records measured local recovery limits. Do not expose private archives, source maps, keys or operator tooling through the frontend host.
