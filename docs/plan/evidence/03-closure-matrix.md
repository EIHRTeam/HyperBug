# Module 03 closure matrix

Owner: [03 security foundation](../modules/03-security-foundation.md). Compiled: 2026-09-29, after the worktree consolidation, under the closure-first instruction. This matrix classifies every unchecked Module 03 checklist item to select the next closable batch and to record exactly which external prerequisite blocks each remaining item. It does not change any checklist state by itself.

Classification keys (updated 2026-09-29 after the Module 03 audit resume; class 3 below now applies only to later modules' audit portions and the stopped Argon2id performance work):

1. **Local** — fully closable in the current local environment (Node 24.21.0, isolated PostgreSQL 18.6, local workerd/Miniflare with D1).
2. **External** — dependent on a real external environment or credential that this host does not have.
3. **Suspended** — blocked by a current user instruction (audit suspension register; Argon2id performance stop).
4. **Free tier** — part of the independent, startup-disabled Cloudflare Free minimum-tier path (ADR 0007), which must not be extended or enabled now.

| Item | Title (short) | Class | Blocking fact |
| --- | --- | --- | --- |
| 03.2e | Standard-profile Argon2id records + login-time rehash | 1 | **Closed 2026-09-29**: the final missing evidence — real-provider login-time rehash on parameter supersession through the actual login operation — was produced on both standard profiles; see [password research](03-password-research.md). |
| 03.2g | Tier-scoped credential policy (PBKDF2 + pepper) | 1 | **Closed 2026-09-29**: measured policy (50k/100k) and the 600k floor rule with its disabling outcome are fixed in code; see [tier validation](03-deployment-tier-validation.md). The tier itself stays startup-disabled pending 13.G6. |
| 03.3a | Permission-aware audit writes/reads | 1 | **Closed 2026-09-29** after the [audit resume](../AUDIT-SUSPENSION.md#resume-2026-09-29--module-03-audit-only); see [audit validation](03-audit-validation.md). |
| 03.3c | Rate-limit ports and both adapters | 2 | Genuine deployed ingress provenance, cross-location enforcement and a deployed storage-unavailable window are all proven (2026-09-30). Remaining: measured route budgets under real load, and recovery/privileged-operation categories whose owning routes do not exist yet (later modules). |
| 03.3d | Bounded activity, abuse metadata, retry hints | 2 | Audit portion implemented 2026-09-29 ([audit validation](03-audit-validation.md)) and now also observed deployed (2026-09-30: the `provider.outage` row from the malformed-secret denial). Remaining: token/project categories and deployed budgets, both bound to owning routes in later modules. |
| 03.3e | Centralized outbound policy; DNS/egress validation | 1 | **Closed 2026-09-30**: the clean-host Node adapter proved public-address DNS pinning, exact GET probes and the real-credential Siteverify `POST` (live `success:true`); the deployed Workers root verified live tokens through its platform transport inside the real routes; arbitrary destinations remain disallowed by the frozen catalog. See [outbound policy](../../OUTBOUND-SECURITY.md). |
| 03.3f | Cache policy; fail-closed key/token/authorization/CAPTCHA/plugin failures | 2 + cross-module | Deployed fail-closed behavior is now observed (2026-09-30: malformed configured secret → 503 `CAPTCHA_UNAVAILABLE` with the permanent audited `provider.outage` row; schema-less D1 window → 503 before CAPTCHA/password; no-store cache policy on every sensitive response). Remaining: plugin-permission failure handling, which requires the suspended Module 05 plugin runtime. |
| 03.3g | Deployment-tier gate | 1 | **Closed 2026-09-30**: audited enablement/change, startup warning and the deployed upload-refusal evidence (error 10021) complete the gate; activation itself remains 13.G6 scope. |
| 03.3h | Minimum-tier compensating abuse controls | 1 | **Closed 2026-09-30**: chosen lockout parameters, digest-only bounded administrator alerting and the declared consistency model are fixed in code; see [tier validation](03-deployment-tier-validation.md). Runtime activation and alert delivery remain later-module/13.G6 scope. |
| 03.V2 | Rejection acceptance (origins, input, rates, destinations, redirects, oversize) | 1 | **Closed 2026-09-30**: all six classes have deployed or live-provider evidence — forbidden origins 403 from two locations, malformed input 400, excessive requests 429 with retry hints on genuine provenance, destination/redirect/oversize rejections through the outbound policy (local, where those rejections live), and live configured-provider success plus live rejection on both profiles. See the admission evidence. |
| 03.V3 | Multi-instance rate consistency; outages deny | 1 | **Closed 2026-09-30**: cross-location genuine-provenance consistency (three client addresses, shared authoritative account dimension 429 across locations with retry hints, per-IP independence, two colos KIX/LHR serving the pair) plus the deployed two-Worker shared-D1 race, and every observed outage denies — schema-less D1 503 before CAPTCHA/password, malformed configured secret 503 audited, local fail-closed mapping. |
| 03.V4 | Seeded-secret inspection; unauthorized audit access | 1 | **Closed 2026-09-29** on consolidated evidence; see [audit validation](03-audit-validation.md). |
| 03.V5 | Password-hash CPU/memory/concurrency/overload record | 3 | Argon2id performance exploration stopped by user instruction; ADR 0009 makes it non-gating and "when available". |
| 03.V6 | Tier gate verification on both runtimes | 1 | **Closed 2026-09-30** on the clause-by-clause evidence mapping including the deployed 10021 refusal; see [tier validation](03-deployment-tier-validation.md). |
| 03.V7 | Real Free-plan PBKDF2 cost curve and floor | 1 | **Closed 2026-09-29**: real-plan measurement, 600k floor decision, fixed policy constants and the deployed audit-append observation recorded; sustained retention measurements remain downstream (09.V6, 10.3g, 13.G6). |

## External prerequisites in detail

For every class-2 component, the exact missing prerequisite, the environment or credential required, an executable verification procedure, the acceptance condition, and the boundary of existing evidence are recorded here so a future session can execute them without re-analysis.

### Genuine Workers ingress provenance (03.3c, 03.3d, 03.V3)

- Missing prerequisite: a deployed public gateway whose `CF-Connecting-IP`/edge address is provably not influenced by same-zone Worker subrequests (Cloudflare documents that same-zone subrequests can influence it through mutable `x-real-ip`), plus a client that does not send `X-Real-IP` (this host's requests carry it).
- Required environment: a deployed HyperBug zone (staging) with the gateway Worker, service-bound private API, real D1 binding and real abuse/ingress/token secrets; an external client host or browser with clean headers.
- Procedure: deploy the existing gateway/API pair to staging; issue registration/login/session/logout from the clean client; verify primary D1 counters record the client's actual address; repeat from a second network location; during a controlled D1 outage window, confirm denial.
- Acceptance: 03.3c/03.3d route-budget and provenance outcomes and the 03.V3 consistency model on genuine provenance.
- Existing evidence proves: local signed-ingress behavior, synthetic fixed-IP deployed two-Worker registration/login/session/logout and counter consistency on `hyperbug-test-1`. It does not prove any genuine edge address, browser origin, second location, or deployed outage.
- 2026-09-30 assessment (superseded later the same day): the unmodified production gateway was deployed publicly for the first time and rejected all direct traffic; a same-account Worker probe was blocked by edge error 1042 and rejected traffic wrote zero primary rows. The day's later session corrected the cause — no MITM exists; the Cloudflare edge force-adds `x-real-ip` equal to the client address on workers.dev **and** custom domains — fixed the gateway to reject only divergent values (commit `f9a02e6`), and then completed the genuine browser flow on an authorized `*.test.eihrteam.org` custom domain with digest-proven genuine client addresses. See [workers ingress](03-workers-ingress.md).

### Valid live Turnstile challenge and provider egress (03.3e, 03.V2, 03.3d)

- **Completed 2026-09-30** with user-provided widget credentials on `turnstile-gw.test.eihrteam.org`: a real automation-flag-free Chrome solved live managed challenges for both actions; the deployed Workers root verified them in-route (register 202, login 200); the clean-host Node adapter's real-credential Siteverify POST returned a live `success:true`; tokenless and garbage tokens denied 403; a malformed secret failed closed 503 with the audited `provider.outage` row.
- Missing prerequisite: real Turnstile credentials (secret, site key, trusted hostname) configured in a deployed environment, and a live widget token for the exact `register`/`login` action.
- Required environment: deployed Workers root with complete hidden bindings; a browser or client able to solve the widget on the trusted hostname.
- Procedure: complete a registration and a login with a live-issued token; observe a verified Siteverify response through the exact catalogued outbound operation; record the outcome in [outbound policy](../../OUTBOUND-SECURITY.md) and the admission evidence.
- Acceptance: configured-provider success path on both profiles; the live-egress portion of 03.V2.
- Existing evidence proves: injected-response success/denial, redirect/oversize/timeout/saturation rejection, and deployed dummy-key negative diagnostics. It does not prove a valid live challenge, real Siteverify egress success, or browser widget integration.

### Node direct TLS egress (03.3e, 03.V2)

- Missing prerequisite: ~~a Node deployment host whose resolver returns public addresses for catalogued destinations~~ — satisfied 2026-09-30 by the authorized clean host `u202f@unpkg`; the remaining prerequisite is the live Turnstile credential for the real Siteverify call.
- Required environment: the actual Node/PostgreSQL deployment environment or any host with unfiltered direct egress and TLS.
- Procedure: run the existing pinned-adapter exact `GET` probe from that host; then exercise the configured Siteverify destination with the real credential.
- Acceptance: a successful direct TLS handshake and a real provider response through the Node adapter.
- Existing evidence proves: address/DNS policy rejection before TLS (including the correct denial on this host), and since 2026-09-30 the successful exact `GET` probe through the real pinned adapter on the clean host — public-address DNS for both catalogued candidates, 200 responses with bounded bodies, plus a local control reproducing the denial. Not yet proven: the real-credential Siteverify `POST` and any live provider response through the Node adapter.

### Cross-location and outage consistency (03.V3)

- **Completed 2026-09-30**: two colos (KIX/LHR) served the custom-domain pair; the authoritative account dimension enforced the login boundary across three client addresses with retry hints while per-IP dimensions stayed independent; a deployed schema-less D1 window and a malformed configured secret both denied without granting.
- Missing prerequisite: at least two Cloudflare locations serving the deployed API pair with genuine provenance, and the ability to observe or induce a provider/primary outage in a deployed environment.
- Procedure: concurrent registrations/logins from two locations against shared primary storage; controlled outage windows for D1/PostgreSQL and the provider.
- Acceptance: the declared consistency model holds across locations and every outage denies.
- Existing evidence proves: local two-root and deployed two-Worker same-host synthetic-IP consistency, sequential and concurrent, plus local fail-closed outage mapping. It does not prove location diversity or deployed outage behavior.
- 2026-09-30 assessment: the authorized second-location host `u202f@unpkg` resolves the workers.dev gateway hostname to a non-Cloudflare address with connection timeouts, so it can serve neither the second clean client nor the browser SOCKS egress for a workers.dev deployment. Two genuinely different clean client addresses require either a reachable custom-domain deployment or an additional clean egress.

### Measured route budgets (03.3c, 03.3d)

- Missing prerequisite: deployed environments with real load; numerical budgets are deliberately not inferred from local fixtures.
- Procedure: measure registration/login/session/logout budgets under representative load on staging for both profiles; record the budget table and wire it into the frozen category policy.
- Acceptance: budget-backed category dimensions on the protected routes.
- Existing evidence proves: the provisional 1,000/60 s approximate ceiling and primary limits function locally; no production budget is claimed.

### Real Cloudflare Free account (03.2g, 03.3h, 03.V6, 03.V7)

- Missing prerequisite: access to a real Cloudflare Free plan account for the tier's own path; also required are administrator alerting and a reviewed parameter floor.
- Procedure: measure the PBKDF2-HMAC-SHA256 cost curve under the per-invocation CPU budget, fix the floor with margin, then run the tier gate and compensating-control verification.
- Acceptance: 03.V7 evidence and gate 13.G6; never substituted for the standard profiles or G1/G2.
- Existing evidence proves: local PBKDF2 mechanism bounds and startup refusal only. The tier remains disabled; nothing here authorizes enabling it.

## Module-completion and G1 governance

As of 2026-09-30 (later sessions), every Module 03 audit and tier item is closed (03.3a, 03.V4, 03.2g, 03.3g, 03.3h, 03.V6, 03.V7) together with the external-environment items 03.3e, 03.V2 and 03.V3; Module 03's remaining open items are 03.3c and 03.3d (measured route budgets under real load, and recovery/privileged-operation/token/project categories whose owning routes exist only in later modules) and 03.3f's plugin-permission failure handling (suspended Module 05 runtime).
As of 2026-09-30, every Module 03 audit and tier item is closed (03.3a, 03.V4, 03.2g, 03.3g, 03.3h, 03.V6, 03.V7); Module 03's only remaining blockers are the external-environment items 03.3c–03.3f, 03.V2 and 03.V3. Module 10 G1 still requires Modules 00–09 complete, and the audit suspension still blocks the audit portions of 04.3a/04.3c/04.V5, 05.2a/05.3d, 06.1c/06.2c, 07.2e and 09.3e — the G1 audit conflict is now confined to those later modules and no longer involves Module 03.

Smallest actionable resolution (requires an explicit user instruction; none is taken here): either resume audit work at one defined milestone before module 10 G1, or record a formal deferral decision (plan amendment plus ADR) that moves the suspended audit scope out of the MVP G1 prerequisite set. Until then, keep suspended items unchecked and do not treat them as failed.
