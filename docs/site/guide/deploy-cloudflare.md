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

## Minimum on a Free account

Select the tier explicitly and acknowledge `minimum-v2`; plan quotas never select or downgrade it automatically. New passwords require at least 12 Unicode code points, at most 1,024 UTF-8 bytes and rejection of the bundled common-password list. New PBKDF2 records use 50,000 iterations, stored costs above 100,000 are refused, and existing stronger records within that ceiling are never reduced. Pepper and per-user salt are mandatory. This is weaker offline protection than Standard Argon2id; prefer passkeys. Online lockout/CAPTCHA cannot offset database-plus-pepper compromise.

Before downgrade, inventory Argon2id credentials with this read-only D1 query (on your exact selected primary):

```sql
SELECT count(*) AS argon2id_remaining
FROM password_credentials
WHERE json_extract(record, '$.alg') = 'Argon2id';
```

Do not enable Minimum while affected accounts lack a verified working passkey/recovery path or an actually available authorized reset. Current Core has no forced-password setter. Test recovery before changing the tier; never rewrite an Argon2id record into a weaker verifier. After upgrading to Standard, successful PBKDF2 login produces the version-fenced Argon2id replacement.

Allocate budgets below account ceilings, including other services, diagnostic queries and unknown-origin traffic. Async has its separate 1.5-million-read/30,000-write daily reservation. Inspect safe retained logs within three days, primary failed-job state, oldest backlog age and adaptive account usage; no Logpush/OTLP export is enabled. Alert on quota allocation exhaustion, growing failures and backlog across two 25-minute phase intervals. Counts saturating at 1001 are lower bounds. Keep each harness-sent native invocation at or below 10 ms with positive label/method/path/status attribution; stop on failure or missing/ambiguous CPU. No warm-up or path exemption is allowed.

The SMTP implementation is deferred to module 16, so there is no runnable relay setting in current Core. Its required future operator relay is public/reachable, TLS implicit 465 or STARTTLS 587 with SASL and private encrypted credentials; no port 25/direct-to-MX or deliverability guarantee. Do not advertise email notifications or invent environment switches.

Actual Free-account evidence on 2026-10-19 demonstrates only a tiny managed-D1 bookmark restore (1,423 ms through verification) and a three-byte R2 capture/restore (1,068 ms), followed by independently verified owned-resource cleanup. Workers Free remains user-attested because billing access is denied. Preflight sampled request headroom was 99,970; D1 headroom was unavailable until delayed 4-read/4-write observations, then 4,999,996/99,996 remained against documented quotas. R2 monthly headroom is unavailable. These service witnesses are not a full Minimum recovery objective or instance ceiling. Password Free CPU fit, complete quota/capacity attribution and full resource recovery remain unverified; 13.1f/13.2g/13.G6 remain open. No staging/paid/publication action occurred.
