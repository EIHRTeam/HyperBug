# Module 10 — P0 provider and transport diagnosis

Date: 2026-10-12 (Asia/Tokyo). Source `a3d3797`; branch `feat/v1`. Scope is **HANDOFF-11 P0 only**: native TLS and CPU attribution. No product code, dependency, baseline or public-contract change. **P0 remains unresolved.** [Scalar receipt](10-p0-provider-diagnostic.json).

## Findings

The local resolver still returns synthetic `198.18.0.0/15` addresses and IPv4-mapped IPv6 for Cloudflare management hosts. Both authorized SSH hosts (`oci`, `unpkg`) are reachable and resolve `test.eihrteam.org` to public Cloudflare IPv4 addresses `104.21.2.97` and `172.67.129.14`. This is zone-level transport evidence; it is neither exact-trial DNS evidence nor a verified TLS handshake for a deployed Minimum instance. Prior trials1–4 remain cleaned and were not probed or reused.

Wrangler4.144.0 initially cannot refresh its existing OAuth login (`UND_ERR_CONNECT_TIMEOUT`). `NODE_OPTIONS=--dns-result-order=ipv4first` restores `whoami` access to the authorized account without re-login, changing permissions or exposing credentials. It does **not** establish that target TLS or every management request now works. No local proxy or TLS bypass is used. A credential-free local curl reaches the OAuth endpoint (404 for a non-token GET); a credential-free API GET returns403. Both SSH hosts also reach the API with a credential-free GET (403), but expose no Wrangler/Node/npx command on their non-interactive PATH. This does not claim that software is absent elsewhere on the hosts; no software is installed there.

Using the existing Wrangler authentication and established ignored provider helper, the authorized zone is readable, but certificate-pack inventory returns **403/9109** and wildcard DNS-record inventory **403/10000**. No permission escalation, dashboard, certificate deletion, SSL setting change or guessed issuance deadline is attempted. Certificate state for a fresh exact hostname remains unavailable. Custom-domain certificates are automatically managed according to current documentation; a wildcard DNS record alone does not prove certificate coverage or issuance.

The unchanged production Minimum and ingress targets build. Two new isolated preparations then fail before a deployed instance is available:

| Attempt | Failure | Accepted requests / CPU samples | Verified cleanup |
| --- | --- | --- | --- |
| Trial5 | Wrangler's GET of the fresh Worker's secret metadata returns Cloudflare504 Gateway Timeout with a malformed HTML API response, before native upload completes | 0 / 0 | 193 original records unchanged; valid FKs; 0 owned Workers/domains/active data; 4 removed permanent key identities retained |
| Trial6 | One fresh retry times out after30s during read-only resource inventory, before deployment or key registration | 0 / 0 | 197 original records unchanged; valid FKs; 0 owned Workers/domains/active data; no new key identities |

The first diagnosis considered the harness's90-second upload timeout; private diagnostics identify the provider504 instead. Trial6's cleanup helper reports its configured four-key count unconditionally, even though deployment never registered them. A separate exact owned-key query verifies trial5 four removed keys and trial6 zero; the scalar report uses observed counts. No database trigger or permanent identity rule is changed.

Each preparation has a new logical backup imported locally with rebuilt derived FTS state, exact table/row counts and valid foreign keys. Each gets new random resource/key names and its own finite20-minute independently authenticated cleanup supervisor. Cleanup preserves captured rows and append-only history; no R2 object, Queue, Workflow or notification is created. Supervisors terminate and all generated secret/private-password copies are removed. No prior backup, name, key or state is reused.

## CPU attribution and stop boundary

Prepared ignored tooling retains only a unique acceptance label, worker role, safe method/path/status, native CPU/wall time and exception names from both production roots. The bounded client runs requests from `oci` through SSH stdin, with standard hostname/chain verification, no persistent remote credential copies, concurrency1 and at most8 requests. It waits for attributable events on both workers before proceeding. The guard still stops on **any** observed native CPU above10ms, including unlabelled traffic, or an invocation failure; missing attribution also stops the client. No filter, warm-up, extra load, instrumentation wrapper or threshold change is introduced.

These scripts were prepared but **not exercised against a deployed instance**: both preparations fail earlier. No new native event, labelled MVP sample, quantile, sustainable capacity or certificate conclusion can be inferred. The prior retained404 observations and historical auth CPU concerns remain unchanged.

## Commands and evidence boundary

- `ssh -o BatchMode=yes -o ConnectTimeout=10 oci 'command -v python3; command -v curl; getent ahostsv4 test.eihrteam.org'` and the corresponding `unpkg` command: pass with public zone DNS. Initial sandbox attempts fail with Operation not permitted; authorized escalation succeeds.
- `node node_modules/wrangler/bin/wrangler.js whoami`: default transport fails. `NODE_OPTIONS=--dns-result-order=ipv4first node node_modules/wrangler/bin/wrangler.js whoami`: passes; version4.144.0. No credential value is printed or stored in public evidence.
- `node tooling/build.ts --target=cloudflare-minimum --target=cloudflare-ingress`: passes, production source unchanged. Existing ineffective dynamic-import warning retained; no bundling redesign.
- `NODE_OPTIONS=--dns-result-order=ipv4first node .local/module10-native-pilot5/preflight.mjs`: readable authorized zone/D1 isolation; certificate and DNS inventory denied as above.
- `NODE_OPTIONS=--dns-result-order=ipv4first node .local/module10-native-pilot{5,6}/backup.mjs`: each passes,59 canonical tables;193 then197 records, valid FKs.
- Each trial's `prepare.mjs`, `supervisor.mjs`, `deploy.mjs`, `cleanup.mjs` and `headroom.mjs` use the established authorized test account/D1/R2 boundary. Trial5 preparation passes, deployment fails504 and guard cleanup passes. Trial6 preparation fails timeout; deployment is **not run**, guard cleanup passes. No hosted tail, target TLS or acceptance client is started.
- Both SSH hosts' `command -v wrangler; command -v node; command -v npx` return no paths; credential-free API connectivity returns403. No remote installation or proxy.
- Final exact-key verification, sampled quota receipts, docs/secret/link/checklist/diff checks are recorded in the scalar receipt and progress records. Application tests are not rerun because behavior is unchanged.

The sampled analytics are account-wide and delayed, **not** per-request cost or billing attribution. Before trial5 estimated remaining requests99,966/reads5,000,000/writes100,000; before trial6 requests99,966/reads4,998,931/writes99,960. Final values are in the scalar receipt. Free-plan identity remains user-attested; no new billing-plan access is claimed.

## Required unblock and gates

Restore certificate/DNS inspection through **MCP or Wrangler**, and a reliable management transport for the authorized account; then run one entirely fresh guarded deployment with exact-domain attachment/DNS evidence, verified `oci` TLS, and labelled MVP requests. The current invocation stop applies unchanged. If a representative request exceeds10ms, stop and return the baseline decision to the user.

10.2a/f and10.3b/g remain partial.10.G2/G4/G5 remain unchecked; G1 **Not passed**, Module11 **Not started**,13.G6 open. **Standard is still not measured and is not the only missing criterion**: actual integrated Minimum acceptance, full metric/quota attribution and sustainable capacity also remain incomplete. P1 does not start, and no G1 exemption or scope expansion is inferred. HANDOFF-11 explicitly requires stopping and reporting an unresolved capability gap; this evidence is that report.

## Current documentation lookup

Context7 resolve→query2026-10-12 selected `/llmstxt/developers_cloudflare_workers_llms-full_txt` (official, High reputation) for custom domains and tails, and `/cloudflare/workers-sdk` for Wrangler OAuth/transport behavior. References: [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Wrangler Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/), [SDK OAuth flow](https://github.com/cloudflare/workers-sdk/blob/main/packages/workers-auth/src/flow.ts). Installed4.144.0 source confirms the timeout/refresh path and that JSON tail mode does not print a connection-ready message; native CPU/status fields still need an actual runtime witness. Returned documentation supplies no fixed certificate issuance deadline or permission grant available to this OAuth session. No frontend HTML/CSS/client JavaScript is implemented, so modern-web-guidance does not apply to this P0-only investigation.

Final verification: docs build1.59s, known credential-signature scan,370 relative links/scalar JSON/production bundle equality/cleanup/gate consistency and `git diff --check` pass. Existing oxfmt ignore rules exclude all explicit documentation targets; scoped formatting is excluded, not passed. No product/browser/performance lane is rerun.
