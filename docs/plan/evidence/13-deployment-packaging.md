# Module 13 — Deployment packaging

Date: 2026-10-19. B1 owns 13.1a–e/13.1g. Prepared/unpublished; no staging or production deployment. G1 Not passed, Module 10 Blocked, global G2 Not passed. Existing source templates are extended by `deploy/` input maps, public-policy validation, offline secret provisioning and the trusted audited registry integration. Reader pages remain paired in English/Chinese.

## Documentation research

Context7 resolve-then-query on 2026-10-19 selected `/cloudflare/cloudflare-docs` (official/high reputation), `/graphile/worker` (official/high) and `/websites/postgresql_18` (official/high). Queries covered D1 Time Travel, Free Queues, Logs/Logpush, Pages static hosting, Graphile shutdown/schema privileges, PostgreSQL dump/restore and globals. Exact CLI syntax is checked with installed Wrangler 4.144.0/PostgreSQL 18.6 help and local runs, not inferred from a plan.

- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/): Free 7 days, Paid 30; restore is destructive/in-place, cancels in-flight work and returns an undo bookmark. It cannot clone a DB. Bookmarks do not back up R2/config/keys.
- [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/): Free 10,000 operations/day and non-configurable 24-hour retention; Paid default 4 days/up to 14. Queues Free exists since 2026-02-04.
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): Free 10 ms/invocation / 100,000 requests/day. No local or Free result is paid Standard acceptance.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/): Free 200,000 events/day, 3 days; [Logpush](https://developers.cloudflare.com/workers/observability/logs/logpush/) is paid. Context7 records an upcoming pricing transition on December 1, 2026: recheck before that date; do not copy future terms into today's evidence. OTLP is disabled by this project's Minimum policy regardless of general provider availability.
- [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/): `_headers` applies to static assets, not Functions. Context7 mixed Workers Assets examples into the SPA query; retain actual Module 11 Pages proof for `! Cache-Control`/fallback rather than claiming the Workers `assets.not_found_handling` setting is Pages configuration.
- [Graphile graceful shutdown](https://worker.graphile.org/docs/glossary#graceful-shutdown): runner.stop drains jobs; the production adapter already supplies noHandleSignals and owns lifecycle. Its current combined pool runs schema migration; no independent reduced-role deployment is claimed.
- [PostgreSQL dump](https://www.postgresql.org/docs/18/backup-dump.html): custom archives restore with pg_restore; per-DB dumps omit roles/tablespaces and do not coordinate blobs. A quiesced multi-resource capture is required here.

No browser/site implementation or custom theme changes occur; plain reader content uses the existing VitePress theme. modern-web-guidance is not triggered by prose-only changes.

## Verification

B1 verification and exact outcome are appended after the batch checks. No public/remote rollout command is executed. The generated private files are discarded after parser/permission checks; their values never enter evidence.

B1 results: Node 24.21.0 / pnpm 11.26.0 / Wrangler 4.144.0. `node tooling/check-deployment.ts node deploy/node/public-policy.example.json` and its `cloudflare` variant pass. Ignored `.local/module13/b1-verify.mjs` runs the real provisioning command in a disposable private directory: 0700 directory/five 0600 files, four distinct keys, actual Node private-file/bootstrap and ingress parsers, exclusive-write refusal with original content retained, and four invalid-policy denials all pass; the directory is removed in finally. No values emitted.

`corepack pnpm typecheck`, `corepack pnpm lint`, scoped `oxfmt`, `corepack pnpm docs:build` and `git diff --check` pass. The initial typecheck identified a root package export boundary; switching the tooling-only security import to its existing relative source resolves it. Wrangler `deploy --dry-run --config apps/api-cloudflare/wrangler.jsonc --outdir .local/module13/dry-standard`, the `--env minimum-local` variant and ingress config variant all exit 0; Minimum has DB/rate/tier bindings and no Queue/Workflow. No remote mutation or dependency change. Logs are ignored `.local/module13/b1-*.log`. The later verified-TLS registry CLI guard preserves peer checking; actual audited activation is exercised in B2 before closing 13.1e.

13.1a–d/g close at packaging scope; production provider/scanner/TLS validation remains explicitly unclaimed. 13.1e awaits the new operator integration's real-store rehearsal.
