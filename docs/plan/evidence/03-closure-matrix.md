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
| 03.2g | Tier-scoped credential policy (PBKDF2 + pepper) | 4 + 2 | Mechanism and migration 0008 exist; completion requires the reviewed Free-plan parameter floor (03.V7) on a real Free account. Tier stays disabled. |
| 03.3a | Permission-aware audit writes/reads | 1 | **Closed 2026-09-29** after the [audit resume](../AUDIT-SUSPENSION.md#resume-2026-09-29--module-03-audit-only); see [audit validation](03-audit-validation.md). |
| 03.3c | Rate-limit ports and both adapters | 2 | Genuine deployed ingress provenance, measured route budgets, cross-location/outage evidence, and recovery/privileged-operation categories whose owning routes do not exist yet. |
| 03.3d | Bounded activity, abuse metadata, retry hints | 2 | Audit portion implemented 2026-09-29 (audited provider-outage policy; see [audit validation](03-audit-validation.md)); remaining scope (token/project categories, deployed budgets) is external/owning-route bound. |
| 03.3e | Centralized outbound policy; DNS/egress validation | 2 | No eligible direct-egress Node environment (this host's resolver returns `198.18.0.0/15`); no live Turnstile credential for deployed Siteverify egress. |
| 03.3f | Cache policy; fail-closed key/token/authorization/CAPTCHA/plugin failures | 2 + cross-module | Plugin-permission failure handling requires the Module 05 plugin runtime (not started); deployed key/provider outage behavior is external. |
| 03.3g | Deployment-tier gate | 4 | Audit portion resumed 2026-09-29; the non-audit mechanism is verified locally and remaining activation work belongs to the disabled minimum tier. |
| 03.3h | Minimum-tier compensating abuse controls | 4 + 2 | Independent minimum-tier path; needs the enabled tier and a real Free deployment for its consistency model. |
| 03.V2 | Rejection acceptance (origins, input, rates, destinations, redirects, oversize) | 2 | All six rejection behaviors have local route evidence; full acceptance has been held to live-egress validation on both profiles, which is unavailable. |
| 03.V3 | Multi-instance rate consistency; outages deny | 2 | Cross-location/multi-instance deployed consistency and deployed outage observation are unavailable. |
| 03.V4 | Seeded-secret inspection; unauthorized audit access | 1 | **Closed 2026-09-29** on consolidated evidence; see [audit validation](03-audit-validation.md). |
| 03.V5 | Password-hash CPU/memory/concurrency/overload record | 3 | Argon2id performance exploration stopped by user instruction; ADR 0009 makes it non-gating and "when available". |
| 03.V6 | Tier gate verification on both runtimes | 4 | Audit portion resumed 2026-09-29; full verification still requires the enabled minimum tier. |
| 03.V7 | Real Free-plan PBKDF2 cost curve and floor | 2 | Audit portion resumed 2026-09-29; the logged-in account is Free-tier, so measurement is environment-authorized but requires the tier's own implementation decisions (parameter floor, alerting) before it can run. |

## External prerequisites in detail

For every class-2 component, the exact missing prerequisite, the environment or credential required, an executable verification procedure, the acceptance condition, and the boundary of existing evidence are recorded here so a future session can execute them without re-analysis.

### Genuine Workers ingress provenance (03.3c, 03.3d, 03.V3)

- Missing prerequisite: a deployed public gateway whose `CF-Connecting-IP`/edge address is provably not influenced by same-zone Worker subrequests (Cloudflare documents that same-zone subrequests can influence it through mutable `x-real-ip`), plus a client that does not send `X-Real-IP` (this host's requests carry it).
- Required environment: a deployed HyperBug zone (staging) with the gateway Worker, service-bound private API, real D1 binding and real abuse/ingress/token secrets; an external client host or browser with clean headers.
- Procedure: deploy the existing gateway/API pair to staging; issue registration/login/session/logout from the clean client; verify primary D1 counters record the client's actual address; repeat from a second network location; during a controlled D1 outage window, confirm denial.
- Acceptance: 03.3c/03.3d route-budget and provenance outcomes and the 03.V3 consistency model on genuine provenance.
- Existing evidence proves: local signed-ingress behavior, synthetic fixed-IP deployed two-Worker registration/login/session/logout and counter consistency on `hyperbug-test-1`. It does not prove any genuine edge address, browser origin, second location, or deployed outage.

### Valid live Turnstile challenge and provider egress (03.3e, 03.V2, 03.3d)

- Missing prerequisite: real Turnstile credentials (secret, site key, trusted hostname) configured in a deployed environment, and a live widget token for the exact `register`/`login` action.
- Required environment: deployed Workers root with complete hidden bindings; a browser or client able to solve the widget on the trusted hostname.
- Procedure: complete a registration and a login with a live-issued token; observe a verified Siteverify response through the exact catalogued outbound operation; record the outcome in [outbound policy](../../OUTBOUND-SECURITY.md) and the admission evidence.
- Acceptance: configured-provider success path on both profiles; the live-egress portion of 03.V2.
- Existing evidence proves: injected-response success/denial, redirect/oversize/timeout/saturation rejection, and deployed dummy-key negative diagnostics. It does not prove a valid live challenge, real Siteverify egress success, or browser widget integration.

### Node direct TLS egress (03.3e, 03.V2)

- Missing prerequisite: a Node deployment host whose resolver returns public addresses for catalogued destinations (this development host returns benchmark-range `198.18.0.0/15`, which the adapter correctly denies).
- Required environment: the actual Node/PostgreSQL deployment environment or any host with unfiltered direct egress and TLS.
- Procedure: run the existing pinned-adapter exact `GET` probe from that host; then exercise the configured Siteverify destination with the real credential.
- Acceptance: a successful direct TLS handshake and a real provider response through the Node adapter.
- Existing evidence proves: address/DNS policy rejection before TLS, including the correct denial on this host. It does not prove any successful outbound TLS from the Node profile.

### Cross-location and outage consistency (03.V3)

- Missing prerequisite: at least two Cloudflare locations serving the deployed API pair with genuine provenance, and the ability to observe or induce a provider/primary outage in a deployed environment.
- Procedure: concurrent registrations/logins from two locations against shared primary storage; controlled outage windows for D1/PostgreSQL and the provider.
- Acceptance: the declared consistency model holds across locations and every outage denies.
- Existing evidence proves: local two-root and deployed two-Worker same-host synthetic-IP consistency, sequential and concurrent, plus local fail-closed outage mapping. It does not prove location diversity or deployed outage behavior.

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

After the 2026-09-29 resume, Module 03's audit items are active again and 03.3a is closed; the remaining Module 03 blockers are the external-environment items (03.3c–03.3f, 03.V2, 03.V3), the independent minimum-tier items (03.2g, 03.3h, 03.V6, 03.V7) and the resumed-but-unassessed audit portions (03.3d/03.3g/03.V4/03.V6/03.V7). Module 10 G1 still requires Modules 00–09 complete, and the suspension still blocks audit portions of 04.3a/04.3c/04.V5, 05.2a/05.3d, 06.1c/06.2c, 07.2e and 09.3e.

Smallest actionable resolution (requires an explicit user instruction; none is taken here): either resume audit work at one defined milestone before module 10 G1, or record a formal deferral decision (plan amendment plus ADR) that moves the suspended audit scope out of the MVP G1 prerequisite set. Until then, keep suspended items unchecked and do not treat them as failed.
