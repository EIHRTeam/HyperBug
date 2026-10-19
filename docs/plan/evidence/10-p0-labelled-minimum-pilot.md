# Module 10 — Labelled Minimum P0 pilot

Date: 2026-10-13 (Asia/Tokyo). Scope: HANDOFF-11 P0(b) only. Trial8; Workers Free standing user attestation; cloudflare-minimum. The [dated decision and binding conditions](10-p0-mcp-trial.md#user-directed-cpu-measurement-decision--2026-10-13) govern every harness request under the unchanged 10 ms rule. **Stopped after the first labelled request returned403 and could not be matched to native events.** TLS verified; labelled CPU is unavailable, so no CPU pass or breach is claimed. [Scalar receipt](10-p0-labelled-minimum-pilot.json).

## Method and preparation

The shared [positive-attribution classifier](../../../tooling/module10-native-attribution.mjs) joins only a request in the sent ledger with its acceptance label, method, path and client response status. Pilot, unfiltered tail reader and independently running finite supervisor use it. The pilot waits for exactly one API and one ingress native event before sending the next request; missing/ambiguous attribution, missing CPU, a matched failure or CPU above10ms stops. Redirects are disabled so the HTTP client cannot silently send an unlabelled follow-up. No harness route is exempt. The existing maximum, never all sent after a stop, is eight requests: instance, readiness, registration and up to five logins; no warm-up or extra load.

Fresh private logical backup captures204 schema objects,59 canonical tables and201 original rows; local restored FKs/counts pass. Initial index-before-table restore order failed locally and was corrected by schema-type ordering without another extraction. First test-key insertion omitted required created_at and failed7500; exact inspection verified0 inserted keys before corrected registration created4. No baseline row changed.

New suffix697c428d5000, hostname acceptance-697c428d5000.test.eihrteam.org, API/ingress Worker names hyperbug-10-{api,ingress}-697c428d5000. Independent supervisor deadline02:00:36UTC. Original inventories contain2 Workers/2 domains/4 certificate packs/36 DNS records. Fresh API/ingress uploads200; backend bundle hashes exactly match trial7. workers.dev/previews disabled. MCP-created unfiltered tails connect before exact-domain attachment. Certificate pending_validation; remote public DNS resolves outside the local synthetic range. Automatic certificate reached active; oci verified TLSv1.3, trusted chain and exact-hostname SAN after14 failed bounded TLS-only attempts. No TLS bypass or HTTP warm-up.

Provider-path deviation: the API multipart payload exceeded the local tool output transport and failed JSON parsing before any MCP upload call. Its subsequent upload used a local Cloudflare API helper authenticated with the existing Wrangler credential, rather than the requested MCP/Wrangler command. Ingress and domain/tail/certificate/DNS operations used MCP. This procedural deviation is recorded; no dashboard, new provider scope, backend wrapper or changed bundle was used. No API upload was retried after success.

## Result and stop

The harness recorded exactly one sent request: label `instance`, GET `/api/v1/instance`, client status403,38.025ms observed client latency. It sent no registration/login/readiness request, followed no redirect and retried nothing. No API/ingress native event matched that label/method/path/status within the existing12-second observation window. The pilot stopped at01:48:13UTC; independent cleanup began01:48:14UTC. The403 cause is undetermined: no retained response body or matching native invocation establishes whether an edge policy or application produced it. Never infer a zero CPU sample, Free CPU fit, a CPU breach, or a completed MVP journey from this response. Every harness request remains subject to10ms, including this unmeasurable one; missing attribution is itself a mandatory stop.

This is a reported unresolved P0 result. Further hosted traffic, alternate clients, edge-policy changes, wrappers and backend remediation are not performed. A new explicit user direction is required before another pilot or remediation. Standard is still not the only unmet criterion.

## Out-of-scope observations and headroom

Unfiltered tails capture62 GET404 events,31 per Worker, all labels absent/outcome ok. API CPU0–11ms/wall0–539ms; ingress CPU0–2ms/wall3–866ms. Two API events reach11ms. They do not match any sent request and do not trigger the amended stop or enter any MVP quantile. Origin remains unknown.

Read-only MCP retained-log accounting retrieves all240 log lines in the exact trial interval, of which80 are CPU-bearing native invocations (40 per Worker; application log lines excluded). It recovers exact method/path/status counts and CPU/wall ranges below. This view overlaps the62 tail events; **do not add their counts**. The initial filtered aggregation returned empty groups despite actual tail evidence; an untruncated needle-scoped event query with server-side scalar projection established the80-record native observation set. Query240/240 completeness is verified. Tail paths outside the five harness endpoints/root/eight-letter pattern were originally represented as `other`; retained invocation request URL pathnames recover the exact path accounting without saving headers, caller identifiers, query strings or bodies. No new acceptance request was sent for this accounting.

| Worker | Method | Path | Status | Count | CPU ms | Wall ms |
| --- | --- | --- | --- | --- | --- | --- |
| api | GET | / | 404 | 1 | 0–0 | 1–1 |
| api | GET | /.env | 404 | 2 | 6–6 | 497–539 |
| api | GET | /.env.backup | 404 | 2 | 0–11 | 0–524 |
| api | GET | /.env.bak | 404 | 2 | 0–7 | 0–503 |
| api | GET | /.env.dev | 404 | 2 | 0–0 | 0–0 |
| api | GET | /.env.live | 404 | 2 | 0–8 | 0–497 |
| api | GET | /.env.local | 404 | 2 | 0–0 | 0–0 |
| api | GET | /.env.old | 404 | 2 | 0–0 | 0–0 |
| api | GET | /.env.prod | 404 | 2 | 0–0 | 0–0 |
| api | GET | /.env.production | 404 | 2 | 0–10 | 0–509 |
| api | GET | /.env.save | 404 | 2 | 0–7 | 1–521 |
| api | GET | /.env.stage | 404 | 2 | 0–0 | 0–1 |
| api | GET | /.env.staging | 404 | 2 | 1–11 | 1–516 |
| api | GET | /.git/HEAD | 404 | 2 | 0–6 | 0–517 |
| api | GET | /api/.env | 404 | 2 | 0–0 | 0–1 |
| api | GET | /app/.env | 404 | 2 | 0–10 | 0–520 |
| api | GET | /application/.env | 404 | 2 | 0–0 | 0–0 |
| api | GET | /backend/.env | 404 | 1 | 0–0 | 0–0 |
| api | GET | /config/.env | 404 | 2 | 0–0 | 0–1 |
| api | GET | /env | 404 | 1 | 0–0 | 0–0 |
| api | GET | /favicon.ico | 404 | 1 | 0–0 | 0–0 |
| api | GET | /functions/.env | 404 | 2 | 0–0 | 0–1 |
| ingress | GET | / | 404 | 1 | 1–1 | 5–5 |
| ingress | GET | /.env | 404 | 2 | 1–1 | 731–776 |
| ingress | GET | /.env.backup | 404 | 2 | 1–1 | 4–866 |
| ingress | GET | /.env.bak | 404 | 2 | 0–1 | 4–693 |
| ingress | GET | /.env.dev | 404 | 2 | 0–0 | 3–4 |
| ingress | GET | /.env.live | 404 | 2 | 0–1 | 4–703 |
| ingress | GET | /.env.local | 404 | 2 | 0–0 | 4–4 |
| ingress | GET | /.env.old | 404 | 2 | 0–0 | 4–4 |
| ingress | GET | /.env.prod | 404 | 2 | 0–0 | 3–3 |
| ingress | GET | /.env.production | 404 | 2 | 0–1 | 4–805 |
| ingress | GET | /.env.save | 404 | 2 | 0–1 | 4–703 |
| ingress | GET | /.env.stage | 404 | 2 | 0–0 | 3–3 |
| ingress | GET | /.env.staging | 404 | 2 | 0–2 | 5–855 |
| ingress | GET | /.git/HEAD | 404 | 2 | 0–1 | 3–706 |
| ingress | GET | /api/.env | 404 | 2 | 0–0 | 3–5 |
| ingress | GET | /app/.env | 404 | 2 | 0–1 | 3–813 |
| ingress | GET | /application/.env | 404 | 2 | 0–0 | 3–4 |
| ingress | GET | /backend/.env | 404 | 1 | 0–0 | 3–3 |
| ingress | GET | /config/.env | 404 | 2 | 0–1 | 5–5 |
| ingress | GET | /env | 404 | 1 | 0–0 | 3–3 |
| ingress | GET | /favicon.ico | 404 | 1 | 0–0 | 3–3 |
| ingress | GET | /functions/.env | 404 | 2 | 0–0 | 3–5 |

During TLS before the pilot, delayed adaptive account headroom estimates were100,000 requests/4,999,248 D1 reads/99,980 writes remaining. After cleanup:99,921/4,998,848/99,960. Out-of-scope traffic still consumes account request and CPU budget; excluding it from MVP metrics never discounts its resource cost. These are sampled account-wide estimates including diagnostics, cleanup and unrelated activity, not billing/per-trial attribution or measured capacity. The80 native observations and79 account requests are distinct delayed measurement populations, not a contradiction resolved by changing counts. No MVP quantiles are calculated; no representative labelled CPU sample exists.

## Cleanup

Independent guard completed01:48:31UTC. All201 original rows are unchanged; restored/final foreign keys pass.0 owned Workers/domains/certificates/DNS/active keys/counters/lockouts/identities. Four exact permanent key identities remain `removed`; no principal, R2 object, Queue, Workflow or external notification was created. Both original Worker/domain IDs, all4 original certificate IDs and36 complete original DNS records are preserved. Domain deletion removed its automatic certificate/DNS; no extra certificate deletion is needed.

Supervisor/transport/pilot are terminal. The tail sockets did not complete their close handshake after Worker deletion; exact owned PID61511 was terminated (exit143). All generated key/password/signing-secret/upload-payload/tail-URL copies were removed; private ignored fresh backup remains and donor R2 credentials are untouched. No automatic-approval rejection remains.

## Verification and documentation lookup

- Positive-attribution checks pass for unrelated/unlabelled/unsent traffic, label/path/status mismatch, pending response, exact10ms,11ms, invocation exception/missing CPU, both-root completion, missing and duplicate events. Syntax checks pass for pilot, tail and supervisor. Scoped oxfmt/oxlint/diff checks pass.
- Context7 resolve followed by query on2026-10-13: /llmstxt/developers_cloudflare_workers_llms-full_txt. Retrieved current Wrangler tail options, native top-level CPU/wall documentation and the Free10ms HTTP/Cron limit, including provider occasional-overrun flexibility. That flexibility never weakens this pilot's hard10ms stop. Context7 does not establish preservation of the complete label/method/path/status tuple; actual native evidence remains required.
- Cloudflare MCP current OpenAPI confirms Worker upload/tails/subdomain/domain/D1/certificate/DNS operations. [Timing documentation](https://developers.cloudflare.com/changelog/post/2025-04-09-workers-timing/) confirms native CPU/wall fields, while [metrics documentation](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/) distinguishes CPU/wall/client latency. Current native field preservation still requires this trial's observed exact tuple.
- Actual commands: NODE_OPTIONS=--dns-result-order=ipv4first node node_modules/wrangler/bin/wrangler.js whoami; private trial8 preflight.mjs, backup.mjs, prepare.mjs, artifacts.mjs, supervisor.mjs, tail-mcp.mjs, transport.mjs and pilot.mjs. Network-dependent local helpers use authorized sandbox escalation; private backups/secrets/URLs stay ignored.

## Gate boundary

Standard remains not measured, G1 Not passed,10.2a/f,10.3b/g and10.G2/G4/G5 remain incomplete,13.G6 open. P1 is already complete at11.1a–g/11.V1; this session performs no frontend work or later increment. No policy/platform/published threshold/degradation/crypto/backend change, paid feature, main/push/merge/PR/production/staging action.

Final repository verification: VitePress1.6.4 docs build, known-credential scan, scoped helper oxfmt/oxlint,585 relative links, scalar receipt/ledger/observation/cleanup consistency, seven unchanged unchecked Module10 IDs and git diff --check pass. No application/frontend green lane is repeated. Changes remain unstaged/uncommitted; protected root drafts/handoffs are untouched.
