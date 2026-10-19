# Install the Cloudflare profile

[Documentation home](../index.md) · [Provider/tier matrix](deployment.md) · [Operations](operations.md)

This is prepared, unpublished deployment guidance. Standard is not measured on a paid account; local and Free results cannot substitute for that acceptance.

## Prepare resources and bindings

Use the source templates `apps/api-cloudflare/wrangler.jsonc` and `wrangler-ingress.jsonc`, with the packaging map in `deploy/cloudflare/README.md`. Make an ignored operator copy with resolved absolute entry/migration paths, dedicated resource names/IDs and exact origins. Keep API private (workers.dev and previews disabled); expose only controlled ingress with the `API` service binding and the same 256-bit base64url `HYPERBUG_INGRESS_KEY` on both roots.

Standard needs D1 `DB`, R2 `HYPERBUG_UPLOAD_BLOB` with matching backend signing secret when uploads are selected, `ASYNC_TASKS` Queue producer/consumer and `ASYNC_WORKFLOW` (`HyperBugWorkflow`). Preserve the five-minute Cron, compatibility flags and `ABUSE_VOLUMETRIC` binding. Minimum uses the separate `src/minimum.ts` entry with explicit `HYPERBUG_DEPLOYMENT_TIER=cloudflare-minimum` and `HYPERBUG_DEGRADATION_ACK=minimum-v2`; omit Queue/Workflow bindings and retain its D1/Cron limits. Repeat non-inherited bindings in each named environment.

## Provision and validate

Generate private operator files with `node tooling/provision-operator-files.ts /absolute/new/private/directory`. Supply key/abuse contents as `HYPERBUG_KEY_RING` / `HYPERBUG_ABUSE_KEY_RING` Worker Secrets. Activate public key references through the existing audited trusted KeyRegistry integration before accounts are enabled. Bootstrap uses secret `HYPERBUG_BOOTSTRAP_ENROLLMENT`, not an ordinary variable. Never copy test material from fixtures. A configured Turnstile requires the complete secret/site-key/hostname selection; public test keys are local-only.

Check public policy with `node tooling/check-deployment.ts cloudflare deploy/node/public-policy.example.json`. Run installed Wrangler dry-run against your exact private config before an authorized rollout. Use `corepack pnpm exec wrangler d1 migrations list <selected-db> --remote --config <private-config>` to inspect, and the corresponding `migrations apply` only during an authorized rollout. Local rehearsal always uses `--local` and an isolated persistence directory. No remote production/staging migration is performed by this guide's preparation.

Worker Secrets can be supplied with the installed `wrangler secret put <binding> --config <private-config>` private prompt or file input; never print values or include them in process arguments. Deploy private API before ingress only when separately authorized. Validate exact hostname certificates, readiness, first-party bootstrap/passkey enrollment, registered `hyperbug-web` callback and real bearer permission checks. A 403 with no uniquely attributed native event is a stop, not an invitation to retry or alter edge policy.

## Frontend, media and recovery

Host [the static build](deploy-frontend.md) independently on Pages or a generic static server. Exact CORS must name the actual frontend; upload CORS permits only reviewed methods/headers and exposes ETag. Media is an isolated origin with current authorization and safe download headers. Storage credentials never enter public config, and successful upload does not establish scanning/release. Production scanner bridge/isolation/update acceptance remains separate.

Record resource IDs, versions, public config and required historical key access before rollout. Keep local/real-Free/paid results separate. Use [the recovery procedure](operations.md), stop on integrity/authorization/audit/CPU failures, and remove every disposable owned resource after an evaluation. This mission does not deploy staging, publish Pages or publish production.

## Background capability limits

The Minimum async foundation has verified failure/replay/retention, checkpoints and capability limits. A fresh native Cron fixture using the complete scheduled method measured 9 ms CPU for interruption after a committed checkpoint, 6 ms for clean redeployment/resume, and 9 ms for maximum-size canonical Issue dispatch. Committed steps were not duplicated and the pending event survived recovery. Native quota refusal/recovery used 2/4 ms in the earlier fixture. Cleanup preserved original data/resources and removed all owned work/resources. These focused observations meet the unchanged 10 ms target but do not establish sustained performance for a complete production deployment; Workers Free is user-attested and billing attribution remains unavailable.

The instance capability document reports background mode, dispatch batch and job step ceilings. Minimum uses a checkpointed D1/Cron runner: one event or job step per corresponding phase, four steps per job and a 1,024-byte checkpoint. The existing five-minute Cron rotates five phases; each phase runs every 25 minutes. Bulk actions, import/export and long-running jobs remain unavailable. Queue or Workflow bindings are not required by Minimum.

Async work reserves a separate daily allowance of 1.5 million D1 reads and 30,000 writes. A denied reservation preserves pending work and reports backlog age. Each invocation stops at 45 SQL statements/combined subrequests, including diagnostic headroom. These allocations do not measure total account usage or guarantee Free CPU acceptance.

`ASYNC_ORPHAN_RETENTION_SECONDS` defaults to 86,400 seconds after intent expiry (range 3,600–31,536,000). `ASYNC_TERMINAL_RETENTION_SECONDS` defaults to 2,592,000 seconds (range 86,400–31,536,000). Failed events remain replayable during the terminal window; expiry retires their source and failure metadata atomically. Pending retries are preserved. Refer to the internal async processing runbook for authorized replay and recovery. The separate Minimum release acceptance gate remains open.

## Search capacity

Cloudflare Minimum searches Issue titles only. Cloudflare Standard searches titles and canonical plain-text bodies. Structured filters remain available; Issue bodies and comments keep their existing content limits. The instance capability document reports `search.textScope` as `title` or `title-and-body`.

When changing profiles, stop dispatchers using the old search mode and rebuild the derived index with the existing authorized administrator service, one bounded page at a time. Follow its returned cursor; Minimum allows at most ten documents per page. Search returns `SEARCH_INDEX_INCOMPLETE` until rebuilding completes. Rebuild again when rolling back. Earlier Minimum search cursors return `CURSOR_STALE`; start a new search. The capacity reduction passes local semantic checks and focused native async CPU/recovery checks; complete profile performance and release acceptance remain open. The 10 ms Free provider ceiling and the separate release acceptance gate remain unchanged.
