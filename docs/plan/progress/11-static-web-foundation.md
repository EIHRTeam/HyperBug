# 11 progress — Static web application, authentication client, and UI foundation

Plan: [Detailed checklist](../modules/11-static-web-foundation.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Complete
- Delivery scope: MVP frontend; all Module 11 authorized on 2026-10-13.
- Prerequisites: G1 remains Not passed; user-directed exception extends to all Module 11; Module 10 remains Blocked.
- Implementation started: Static foundation, memory-only browser authentication and accessible primitives implemented and verified.
- Completed implementation checklist IDs: 11.1a–g, 11.2a–e, 11.3a–e and 11.V1–V5 (all 22 items).
- Active/next checklist group: None within Module 11; Module 12 remains unopened.
- Last updated: 2026-10-13.
- Blocking issues discovered: None within Module 11. Backend G1 and Module 10 remain incomplete.
- Evidence: [Final report](../evidence/11-completion.md), [local cleanup](../evidence/11-local-cleanup.json), [P1 report](../evidence/11-p1-foundation.md), [frontend engineering guide](../../development/FRONTEND.md) and [P0 MCP report](../evidence/10-p0-mcp-trial.md).

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 11.1 | Establish the static application | Complete | P1 report; actual types/lint/build/config/capability checks |
| 11.V1 | Same-build generic/Pages preview | Complete | Same-build hosting and zero-owned-resource receipt |
| 11.2 | Implement the browser auth boundary | Complete | B1 review, auth unit5, real cross-site and identity/draft receipts |
| 11.3 | Build accessible reusable UI primitives | Complete | B2 source/UI receipt, user manual all-pass, contrast and compatibility ledger |
| 11.V2–V5 | Auth/accessibility/performance/capabilities | Complete | Final report; local-only evidence and zero-owned-resource cleanup |

The linked plan owns the canonical checkboxes. No backend gate or later frontend acceptance is implied.

## Next actions

1. Module 11 is complete; no remaining action within this scope.
2. Preserve G1 Not passed, Module 10 Blocked and 13.G6 open; no Module 12 or hosted traffic.

## Next-session cautions

Public config and static output only; no persistent browser credentials, SSR, Functions or mandatory proxy. Invalid config/instance data must fail closed. Regenerate CSP when origins change. The temporary Pages project and both previews are deleted with preserved original inventory; do not reuse their names/state. All owned local B2/B3 services, private data, certificate trust/entry and temporary UI/trace artifacts are cleaned. Protected root drafts remain unstaged; no push/PR/production release is authorized.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 11; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for static web application, authentication client, and ui foundation.
- Files/artifacts: `docs/plan/modules/11-static-web-foundation.md`; `docs/plan/progress/11-static-web-foundation.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 11.1.
- Next-session cautions: The frontend is a static SPA. Apply modern-web guidance with project-specific exceptions: no same-origin cookie API, SSR fallback, or persistent browser credentials.

### 2026-09-20 — Capability-driven application states planned

- Scope and checklist IDs: Planning only. Added 11.1g and 11.V5. No implementation item was completed or checked.
- Progress: Recorded that the static application consumes the instance capability document, enables only available surfaces, and explains unavailable capabilities instead of failing.
- Change summary: Extended the module plan; the static SPA boundary, memory-only tokens and CSP requirements are unchanged, and no runtime code injection is introduced.
- Files/artifacts: `docs/plan/modules/11-static-web-foundation.md`; [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); this record.
- Verification: Documentation-only session; the package-wide validator result is in the master session entry. No frontend code or browser check ran.
- Decisions and deviations: Capability advertisement is presentation only and is never an authorization control.
- Blockers/open questions: 11.V5 depends on 04.2g and on the SPA existing after G1.
- Next actions: Continue 11.1 in order; consume the capability document when the API client is built.
- Next-session cautions: Never let the client infer capabilities from its own configuration or present a degraded instance as the standard profile.


### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: SPA prerequisite planning only; no implementation item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior static-web planning text; no SPA source was created.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: G1 remains closed.
- Next actions: Do not start Module 11 during the feature hold.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-10-12 — HANDOFF-11 P0 prerequisite investigation

- Scope and checklist IDs: P0 native Module10 blockers only, cross-linked prerequisite impact for11.1; no Module11 implementation or completed checklist item.
- Progress: G1 remains Not passed and Module11 Not started. Fresh authorized native diagnosis is in progress after clean SSH/DNS access and Wrangler IPv4-first authentication recovery.
- Change summary: Record the P0→P1 boundary; do not scaffold the SPA or change frontend dependencies/configuration.
- Files/artifacts: This record and [Module10 P0 session](10-backend-acceptance.md); fresh trial receipt to follow.
- Verification: Both authorized SSH hosts are reachable; exact hosted TLS/labelled CPU evidence pending. Frontend checks not run because no frontend exists or changes.
- Decisions and deviations: User requests P0 only. HANDOFF-11 requires reporting P0 and explicit go-ahead before P1; all prerequisites/gates remain intact. Standard stays unmeasured under the standing decision.
- Blockers/open questions: Native TLS cause and labelled MVP CPU remain unresolved; provider certificate/DNS inventory APIs deny existing OAuth permissions.
- Next actions: Finish/report bounded P0 diagnosis and cleanup; assess the remaining blockers honestly. Do not begin11.1 in this session.
- Next-session cautions: Never infer a G1 exemption, threshold change or P1 authorization from successful upload or partial TLS/CPU evidence. Protected handoffs remain unstaged.

### 2026-10-12 — P0 unresolved; frontend boundary preserved

- Scope and checklist IDs: HANDOFF-11 P0 prerequisite reporting only;11.1/11.V1 remain untouched and unchecked.
- Progress: P0 cannot establish deployed TLS or labelled native CPU after provider504/inventory timeout and403 certificate/DNS visibility. Module11 stays Not started; G1 stays Not passed.
- Change summary: Update prerequisite status and next actions; link the final provider diagnosis. No apps/web, dependency, frontend configuration or browser-auth change.
- Files/artifacts: This record, [P0 evidence](../evidence/10-p0-provider-diagnostic.md) and [Module10 final session](10-backend-acceptance.md); master summary.
- Verification: Both guarded preparations cleaned with193/197 original rows unchanged/FKs valid/0 owned resources; no target TLS/acceptance HTTP/CPU/browser check ran. Final documentation checks are shared with Module10 below.
- Decisions and deviations: User requests P0 only. No gate exemption, P1 go-ahead or Standard measurement is inferred. HANDOFF-11 explicitly requires stopping on unresolved provider capability gaps.
- Blockers/open questions: P0/native access and incomplete G1 criteria; Standard is not the only missing row/outcome.
- Next actions: Restore provider inspection/transport access; complete/report a fresh guarded P0 trial. Preserve G1 and obtain the explicit P0→P1 decision before frontend work.
- Next-session cautions: No frontend implementation evidence exists.10.2a/f,10.3b/g and10.G2/G4/G5 stay incomplete;13.G6 remains separate. Protected root handoffs untouched.

Final P0 verification: installed VitePress1.6.4 docs build passes1.59s; `node tooling/secrets.mjs` passes; scoped Python validation passes370 relative links, scalar JSON, unchanged repaired-production bundle hashes, observed cleanup/key counts, ephemeral secret removal and the exact seven unchecked Module10 IDs; G1/Module11 states are unchanged. `git diff --check` passes. Installed oxfmt explicitly excludes all seven documentation targets under existing ignore rules (exit2/no targets), so formatting is recorded excluded, not passed. Application/browser/performance lanes are not rerun because product behavior is unchanged; no hosted acceptance request or sample ran.

### 2026-10-12 — P0 Cloudflare API MCP continuation started

- Scope and checklist IDs: HANDOFF-11 P0 only; 10.2a/f, 10.3b/g and gate reporting; no P1 implementation.
- Progress: MCP reads authorized Workers/domains, active zone, certificate packs and full DNS inventory successfully; earlier Wrangler certificate/DNS permission gaps are cleared on this connection.
- Change summary: Prepare one fresh guarded production-bundle trial; exact-domain TLS probes from authorized oci, followed only by bounded labelled MVP requests if verified.
- Files/artifacts: Ignored .local/module10-native-pilot7 preparation; scalar report pending.
- Verification: Certificate/DNS MCP200, three existing certificate packs and36 DNS records; two original Worker domains. No matching old trial certificate or wildcard test DNS record.
- Decisions and deviations: Preserve10ms stop on every observed invocation, no warm-up/filter/TLS bypass, no paid/Standard/SPA action.
- Blockers/open questions: Fresh-domain certificate/TLS and representative CPU not yet established.
- Next actions: Fresh backup/inventory, finite independent cleanup, unchanged native upload through MCP, domain/certificate verification and remote TLS.
- Next-session cautions: Never reuse trials1–6 state/names/backups/secrets; G1 Not passed, Module11 Not started,13.G6 open.

### 2026-10-12 — P0 TLS resolved through MCP; frontend remains gated

- Scope and checklist IDs: P0 prerequisite reporting only; 11.1/11.V1 remain unstarted and unchecked.
- Progress: Provider visibility and verified remote TLS resolve. Native CPU guard stops on unlabelled16ms GET404 traffic before any labelled MVP request; P0 remains partial.
- Change summary: Update current prerequisite blockers and cross-link Module10 evidence; no frontend files, dependencies, application checks or capability behavior change.
- Files/artifacts: This log, [MCP report](../evidence/10-p0-mcp-trial.md), [scalar receipt](../evidence/10-p0-mcp-trial.json), Module10 and master records.
- Verification: Fresh backup/production uploads/domain/certificate/TLS/native guard and cleanup pass at their stated scopes; full original resources/197rows/FKs preserved,0 owned resources/active data and generated secrets removed. Documentation verification follows; browser/application tests not run.
- Decisions and deviations: Explicit user authorizations resolve automatic-review backup/secret-upload rejections.10ms unchanged; no G1 exemption or P0→P1 authorization inferred. Standard remains unmeasured.
- Blockers/open questions: Actual Minimum integration/full metrics/quota/capacity and labelled CPU remain incomplete in addition to Standard. G1 Not passed, Module11 Not started,13.G6 open.
- Next actions: Report remaining CPU stop; user decides any further rule/remediation scope. Do not begin11.1.
- Next-session cautions: Trials1–7 cleaned; no reused resource/state/secret or extra load, baseline weakening, main/merge/paid/SPA action. Protected drafts stay unstaged.

Final MCP P0 verification: installed VitePress1.6.4 documentation build passes; `node tooling/secrets.mjs` passes; scoped Python validates468 relative links, scalar JSON/cleanup/CPU/TLS invariants, the exact seven unchecked Module10 IDs and unchanged G1/Module11 gates; `git diff --check` passes. Scoped installed oxfmt exits2 because existing docs/** ignore rules exclude all10 targets; formatting is excluded, not passed. No product/application/browser/performance lane is rerun because source behavior is unchanged. No new hosted acceptance request is sent.

### 2026-10-12 — Explicit P1 continuation after P0 report

- Scope and checklist IDs: User's latest active goal explicitly requests continuing and completing HANDOFF-11 P1: 11.1a–g and11.V1 only.
- Progress: Read current guidance/checklist, confirm no apps/web exists and fresh P0 report/cleanup committed as32d49e7. Begin frontend research and dependency verification.
- Change summary: Record the new scoped sequencing authorization after the P0 boundary report. This supersedes the earlier prohibition on starting this P1 scope; it does not make any backend acceptance criterion pass.
- Files/artifacts: This progress record; modern-web guide receipts and Context7/registry lookups to be linked in P1 evidence.
- Verification: Actual worktree has only protected untracked root drafts; G0 passed, G1 Not passed. P0 TLS/provider inspection resolved, CPU attribution still blocked. Context7 selected stack resolve/query and action-oriented modern-web search run before implementation.
- Decisions and deviations: Treat the explicit latest P1 goal as a narrow user-directed sequencing exception. Preserve all Module10 unchecked IDs, G1 Not passed, CPU10ms and Standard exclusion.11.2/11.3/11.V2–V5 and Module12 stay outside scope. Temporary Pages preview is already authorized with random names and complete cleanup.
- Blockers/open questions: Current dependency versions/compatibility and actual same-build generic/Pages verification to establish. No further native P0 traffic.
- Next actions: Complete research, scaffold exact authorized stack/runtime config/capability foundation/security-header deployment tooling, then one focused verification step and Pages cleanup.
- Next-session cautions: No gate passing inferred from P1; no backend/crypto/migration/policy change or unrelated package upgrade. Protected drafts remain unstaged.

P1 checkpoint: Config-first entry, React/TanStack Router/Query shell with split overview/instance routes, shared public-capability validation, reviewed build-time plugin-origin declarations, neutral Tailwind/shadcn Base UI scaffold, deployment policy generation and portable static host are implemented. Registry-pinned dependencies install with strict peers; pnpm adds exact release-age exclusions for @tanstack/query-core/react-query5.104.2, recorded for review rather than silently treated as old policy. No lifecycle allowance expanded. Existing root typecheck/build now include the web app; no product auth/workflow/UI primitive increment is started. Whole-step types/lint/build verification is in progress; hosted11.V1 remains pending and P0/G1 unchanged.

### 2026-10-13 — P1 implemented with compiler and Oxc tooling; cleanup approval pending

- Scope and checklist IDs: 11.1a–g/11.V1 plus explicit React Compiler, oxlint and oxfmt request; no later increment or backend repair.
- Progress: 11.1a–g implemented and verified. Same-build generic/Pages deep links/config replacement pass;11.V1 remains unchecked pending owned Pages cleanup.
- Change summary: Add static React/TanStack capability foundation, config-first validated entry, deployment CSP/cache adapters, compiler, frontend lint/format scripts, TSX boundaries and root build/types integration. Synchronize English/Chinese operator guide.
- Files/artifacts: `apps/web`, workspace manifests/lockfile, root tooling/config, focused test, [P1 evidence](../evidence/11-p1-foundation.md), [engineering guide](../../development/FRONTEND.md), bilingual hosting pages.
- Verification: Root types/lint, frontend lint/format/build, frozen offline install,15-expression license scan, secret scan pass;10 focused trust/lint/boundary tests pass. Actual preview and local Node API/browser proof; no full backend/CWV/accessibility/auth acceptance claimed. Documentation build/links/whitespace recorded below.
- Decisions and deviations: Explicit P1 sequencing exception leaves G1 Not passed. Exact reviewed dev-license/release-age exceptions; no old external package removed or importer changed except root public-client link and new web importer. Stable compiler Babel bridge; no experimental compiler or lifecycle relaxation.
- Blockers/open questions: Guardian authentication/cleanup failed and exited; automatic review rejects exact Pages project deletion pending direct user authorization. Owned project/two previews remain. P0 CPU/G1 unchanged.
- Next actions: Obtain pending exact cleanup approval, delete only owned project via MCP, verify original six names and0 owned project/deployments, then close11.V1/P1. No later increment/push/PR edit.
- Next-session cautions: Do not bypass rejected deletion or infer cleanup from attempted stop. Local listeners and owned browser tabs are closed. Protected drafts/handoffs remain unstaged; config origin changes require regenerated CSP. Preserve all Module10 incomplete checks and unchanged10ms rule.

Final P1 local handoff: installed VitePress1.6.4 docs build passes;448 scoped relative links and checklist/G1 consistency pass; `git diff --check` passes. Frontend/root scoped oxfmt pass; documentation is manually maintained under the existing docs ignore policy. Root drafts/handoffs remain unstaged. P1 cleanup remains pending exactly as recorded above; do not mark the goal complete until verified.

### 2026-10-13 — Explicit cleanup approval and P1 closure

- Scope and checklist IDs: Complete the remaining11.V1 owned-resource cleanup; final11.1a–g/11.V1 requirement audit only.
- Progress: User explicitly authorizes deletion of hyperbug-11-9f880c7e4720 and both preview deployments. MCP deletion200 and subsequent project/list/exact-deployment absence checks pass; original six names/subdomains preserved. P1 complete; Module11 remains In progress for later unauthorized increments.
- Change summary: Close11.V1, update current handoff/master and retain a scalar cleanup receipt. No application/backend/toolchain change.
- Files/artifacts: [P1 report](../evidence/11-p1-foundation.md), [cleanup receipt](../evidence/11-p1-cleanup.json), paired checklist/progress, master and plan entry point.
- Verification: Real cloudflare-api MCP deletion and provider8000007 absence proof at06:45 JST; saved-before/final inventory equality; no listeners on4173/4408. Existing committed browser/build/test evidence remains intact. Final documentation/link/secret/whitespace checks follow.
- Decisions and deviations: Explicit approval resolves the automatic-review rejection; no workaround or unauthorized deletion. G1 Not passed, Module10 incomplete items and unchanged10ms rule preserved.
- Blockers/open questions: None within P1; no backend-gate closure implied.
- Next actions: No further authorized P1 work. Await separate direction for11.2/11.3 or backend prerequisites; no push/PR action.
- Next-session cautions: Temporary project/deployments cleaned; protected root drafts remain unstaged; preserve current static trust boundary and regeneration of CSP with runtime origins.

Final closure checks: VitePress1.6.4 docs build,367 scoped relative links, JSON/cleanup/original-inventory assertions, exact eight P1 checkboxes, unchanged compiled hashes/application/backend source, secret signatures and whitespace pass. Earlier application verification is retained because only provider cleanup and engineering records changed. Protected root drafts remain untracked. P1 is complete; G1 remains Not passed.

### 2026-10-13 — PR 2 unused vulnerable generator dependency removal

- Scope and checklist IDs: CI maintenance of01.3b/11.1b; no product or gate expansion.
- Progress: Repair157591e passes hosted formatting/unit/contract/secret/license steps but exposes high-severity audit failure in job115032553620. GHSA-vfj7-8cjw-p6xm affects braces<=3.0.3; upstream lists no patched version. All reported paths originate from the unused shadcn4.21.4 CLI.
- Change summary: Remove only the generator dev dependency and prune its unreachable graph; retain components.json/Base UI/runtime source and all other versions. Update the frontend engineering guide with the removal and safe future restoration condition.
- Files/artifacts: apps/web/package.json, pnpm-lock.yaml, docs/development/FRONTEND.md, Module01/11 progress; [audit job](https://github.com/EIHRTeam/HyperBug/actions/runs/38315969831/job/115032553620).
- Verification: pnpm11.26.0 lockfile-only offline update; parsed lockfile assertions preserve settings/all other importers/package metadata/retained snapshots, remove247 entries and add none. Isolated fresh frozen install passes798-entry supply-chain policies/512 installed packages. Full typecheck/lint/format571/API drift75/build pass;54 unit files406 checks plus2 contract checks pass; focused frontend/boundary8 checks pass; licenses13 expressions and root credential scan pass. pnpm audit --audit-level high --json exits0:0 high/critical,1 moderate.
- Decisions and deviations: Focused review finds no CLI import/script or runtime dependency, so removal preserves application behavior and avoids an unpatched graph without suppressing audit or relaxing policies. Context7 resolve/query2026-10-13 /websites/pnpm_io covers lockfile-only/frozen installation; installed pnpm11 commands verify actual behavior. Primary advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm; install documentation: https://pnpm.io/cli/install.
- Blockers/open questions: None in the local repair. Sandbox audit fails fetch and offline clean install lacks cached metadata; authorized online retry passes. Existing-worktree install aborts its no-TTY purge; no purge performed. Snapshot secret scan lacks .git, corrected by running the root scan; external-cache license read requires authorized escalation and then passes. Hosted second repair pending.
- Next actions: Publish this separate coherent fix, confirm fresh quality/runtime/docs/CodeQL results and record final hosted evidence. Restore a generator only when its reviewed dependency graph passes the unchanged audit; later primitives remain a separate increment.
- Next-session cautions: Protected drafts untouched; no UI/runtime source, lifecycle policy, migration, dependency upgrade, main push, merge or acceptance gate change. Workstation installation may still contain the old CLI; frozen CI graph and clean snapshot omit it.

Hosted quality closure: repair commits157591e/886da14 are pushed to feat/v1/PR2. Both push and PR quality jobs pass the full lane (including frozen install, format,406 unit/2 contract checks, secrets/licenses, high-severity audit and full build): [PR run38316851149](https://github.com/EIHRTeam/HyperBug/actions/runs/38316851149), [push run38316845131](https://github.com/EIHRTeam/HyperBug/actions/runs/38316845131). Node runtime, Documentation38316851151 and CodeQL38316851226 also pass; workerd/PostgreSQL are still running at this recording checkpoint. Changed engineering/progress relative links and whitespace pass. Final CI observation remains before user handoff; no source modification or additional local application test is needed for this closing record. Module/gate state and protected drafts are unchanged.

### 2026-10-13 — P0 CPU decision and labelled pilot resumed

- Scope and checklist IDs: HANDOFF-11 P0(b) only, owned by Module10; no frontend checklist changes.
- Progress/change summary: Record the dated positive-attribution conditions and prepare fresh trial8 after P1 completion. P1 remains complete at11.1a–g/11.V1; later increments unauthorized.
- Files/artifacts: [Binding P0 decision](../evidence/10-p0-mcp-trial.md#user-directed-cpu-measurement-decision--2026-10-13), [labelled pilot](../evidence/10-p0-labelled-minimum-pilot.md), Module10/plan records and shared measurement helper.
- Verification: Preparation/attribution checks pass; native labelled result pending verified TLS.
- Decisions and deviations: Every harness request retains10ms, exact sent tuple/native match required; other observations excluded from MVP metrics but retained/account-budget consuming. Platform/published bounds/13.G6 unchanged; procedural provider upload-path deviation recorded in P0 evidence.
- Blockers/open questions: Module10 acceptance/Standard/G1 remain incomplete; no frontend blocker is repaired here.
- Next actions: Finish only the authorized labelled pilot and cleanup, then report Module10 outcome.
- Next-session cautions: No11.2/11.3/11.V2–V5/Module12 or backend extension; protected drafts unstaged.

### 2026-10-13 — P0 labelled pilot stop and cleanup

- Scope and checklist IDs: P0(b)/Module10 evidence only; no frontend checks changed.
- Progress/change summary: Apply all dated CPU conditions, verify fresh TLS, send1 labelled instance GET403 and stop for missing unique native attribution. P1 remains complete; Module11 In progress at its existing scope.
- Files/artifacts: [Final P0 report](../evidence/10-p0-labelled-minimum-pilot.md), [receipt](../evidence/10-p0-labelled-minimum-pilot.json), Module10/plan user-directed state and shared attribution helper.
- Verification: Positive-attribution checks/docs/format/lint/secrets pass;201 baseline rows/FKs/original inventories preserved,0 owned resources/active data and terminal handles/generated-secret cleanup verified. No frontend lane rerun.
- Decisions and deviations: Labelled CPU unavailable; no pass/breach/quantile inferred.62 tail/80 retained observations excluded from MVP metrics but retained/account-budget consuming.10ms/platform/published thresholds/13.G6 unchanged; procedural upload-path deviation in P0 report.
- Blockers/open questions: Module10 missing native attribution/integration/metrics/quota/capacity and Standard; G1 Not passed.
- Next actions: Report/stop; await explicit bounded P0 direction. No further hosted load or frontend increment.
- Next-session cautions: Trial8 cleaned; preserve protected drafts and P1-only scope (no11.2/11.3/11.V2–V5/Module12).

P0 closure checks:585 relative links/receipt/gate/cleanup consistency and git diff --check pass, with existing final docs build/secrets/scoped helper formatting/lint evidence. P1 source/hosting/cleanup and its completed checks remain unchanged; no further frontend implementation/testing or hosted load.

### 2026-10-13 — User-authorized P0 checkpoint publication

- Scope and checklist IDs: Commit/push the prepared CPU-decision, positive-attribution helper and trial8 evidence only; no checklist or gate closure.
- Progress/change summary: User explicitly authorizes publication on feat/v1, superseding this batch's earlier no-push instruction. Pilot remains stopped after labelled instance GET403 lacked native attribution; no new implementation or hosted traffic.
- Files/artifacts: Prepared Module10 P0 reports/receipt, plan state/EXECUTION, affected evidence and Module10/11 logs, tooling/module10-native-attribution.mjs. Protected root drafts/handoffs and ignored private backups/tooling remain excluded.
- Verification: Prior focused attribution/syntax/docs/lint/format/secret/585-link/receipt/cleanup checks remain valid; publication hygiene and remote commit verification are performed in this session. Context7 resolve/query2026-10-13: /git/htmldocs for explicit staging, normal branch push and remote-ref verification; no documentation gap affecting the operation. No green application or hosted lanes repeated.
- Decisions and deviations: Publish one coherent Conventional Commit with a normal non-force origin push.10ms/platform/baselines/degradation/13.G6 unchanged; Standard unmeasured/G1 Not passed/P1-only scope retained.
- Blockers/open questions: Existing Module10 native attribution/integration/metrics/quota/capacity and Standard gaps remain.
- Next actions: Complete authorized commit/push and verify origin/feat/v1; no further pilot or remediation without new direction.
- Next-session cautions: Trial8 cleaned; no private data/protected drafts, main/merge/PR edit, force push or scope extension.


### 2026-10-13 — Module 11 completion begins

- Scope and checklist IDs: HANDOFF-11 authorizes 11.2a–e, 11.3a–e and 11.V2–V5, extending the P1 sequencing exception only to Module 11.
- Progress: Required guidance/protocol/current source and local fixture inspected; B1 selected.
- Change summary: Record the dated sequencing decision in EXECUTION, plan entry point, G1 row and owning plan/log.
- Files/artifacts: Module 11 plan/log, EXECUTION, README and master progress; research ledger will extend FRONTEND.
- Verification: Initial working tree inspected on feat/v1; implementation checks not yet run. Context7 Query/Form resolve/query and modern-web action search/retrieval performed.
- Decisions and deviations: Existing bearer revocation provides API-only logout; cookie-authenticated authorization sessions remain separate. No protocol/policy change.
- Blockers/open questions: None yet; real browser TLS must use trusted local certificates without verification bypass.
- Next actions: Implement B1, verify once per batch, commit coherent changes; then B2/B3.
- Next-session cautions: Protected untracked root drafts/handoffs must remain unstaged. No hosted resources/traffic, P0, later modules, push/PR edits; G1 Not passed, Module 10 Blocked, 13.G6 open.


### 2026-10-13 — B1 browser auth boundary

- Scope and checklist IDs: 11.2a–e. a/b/c/e verified; 11.2d implemented with cache/epoch unit evidence, browser draft proof reserved for B3.
- Progress: Memory-only auth, PKCE and API-only logout implemented. Real cross-site SPA login/reload recovery/revocation passes.
- Change summary: BrowserAuth private token/snapshot boundary, callback cleanup, five-minute one-shot origin-bound redirect state, cancellation/cache/epoch invalidation and account route.
- Files/artifacts: apps/web/src/{auth,main,app}, routes/account, auth unit invariants, reusable local browser fixture/runners, FRONTEND, [browser receipt](../evidence/11-browser-auth.json).
- Verification: Node24.21.0/pnpm11.26.0; web typecheck/lint/build pass; focused auth3/foundation5 tests pass; root typecheck passes. Local PostgreSQL18.6, real Chrome155.0.8059.40, generated test certificate trusted without verification bypass: two callbacks, blocked third-party canary, omitted cookies, reload/recovery, revocation401, zero local/session/IndexedDB/cache entries and token-free URL/console checks pass.
- Decisions and deviations: Existing API-only logout is explicit in UI; authorization-service cookie session remains separate. First canary attempt was refused by app CSP; move only the probe to isolated fixture document, preserving exact app CSP. Temporary trust is removed on fixture cleanup.
- Blockers/open questions: No B1 blocker. Native dialog/form/draft/browser baseline proof remains B2/B3.
- Next actions: Commit B1; implement B2 accessible primitives; complete B3 evidence.
- Next-session cautions: Local fixture intentionally held for the following batches, must terminate and independently verify cleanup. No hosted traffic, G1/Module10/13.G6 change, later module, push or PR edit.


### 2026-10-13 — B2 accessible primitives

- Scope and checklist IDs: 11.3a–e; b–e implemented and focused-browser verified. 11.3a awaits final contrast/manual cross-browser evidence in B3; 11.V3 remains open.
- Progress: Field/error/state/native-dialog primitives, committed-route focus/title and trusted plugin slot implemented; no Module 12 workflow.
- Change summary: Single delayed visual/ARIA validation state, error summary focus/links, native Cancel/Escape/restore focus, responsive outline/field/dialog styles and frozen source-only plugin descriptors/CSP origins. Separate test-only UI build excludes acceptance hooks from production.
- Files/artifacts: apps/web/components, routes, forms/plugins/styles, fixture/scripts/tooling inclusion, FRONTEND compatibility ledger, local runner cleanup repair, [UI browser receipt](../evidence/11-ui-browser.json).
- Verification: Web typecheck/lint/build pass; plugin/foundation6 unit cases pass. Chrome155.0.8059.40 rendered form/error-summary/dialog/reflow/reduced-motion/emulated-touch/CSP checks pass. First passes expose Form isTouched-on-change and stale blur errors; correct with isBlurred/submit gating and blur revalidation, without weakened assertions. Invisible closed-dialog buttons are excluded from visible touch-target measurement.
- Decisions and deviations: User directs no computer-use tests; manual Safari/VoiceOver/keyboard/zoom/touch/motion instructions sent. Automated checks continue; no screen-reader conformance claim. Native VoiceOver inspection timed out and process was not running. Mac certificate prompt approved by user; temporary certificate/trust is cleanup-owned. Initial B1 SIGTERM cleanup met adapter already-closed listener; fix narrowly and remove both exact session-created keychain entries by fingerprint.
- Blockers/open questions: Manual results pending. Local certificate and services remain held for those checks; owning fixture cleanup must complete.
- Next actions: Commit B2 after scoped checks, then B3 identity/cache/capability/performance evidence and user manual report.
- Next-session cautions: No CUA test actions. Keep existing gates/Module10/13.G6 and protected drafts unchanged; no hosted traffic, added dependency or later workflow.


2026-10-13 manual checkpoint: the user reports **all pass** for the eight requested Safari/VoiceOver/keyboard/field/dialog/zoom/emulated-touch/reduced-motion/navigation checks. [Manual receipt](../evidence/11-manual-accessibility.json) distinguishes user evidence from automation and records the installed Safari version, not an independently reported version. No further CUA testing. B2 source/type/lint/format/build and focused UI/plugin checks pass; final 11.V3 closure remains in B3 with contrast and documented limits.


### 2026-10-13 — B3 verification and module completion

- Scope and checklist IDs: Close 11.2d, 11.3a and 11.V2–V5; all 22 Module 11 checks complete, with retained P1 evidence.
- Progress: Module 11 Complete at the scoped user-directed sequencing exception. G1 Not passed, Module 10 Blocked, 13.G6 open; Module 12 and later modules remain unopened.
- Change summary: Real cross-site final auth/identity/draft proof, user manual accessibility report, measured contrast, actual local Minimum capability application/failure states, production CDP/CWV/bundle/CSP baseline, synchronized English/Chinese reader guide and exact local cleanup. Final callback exchange joins cancellation/epoch protection; unavailable storage cannot strand sign-in or skip revocation.
- Files/artifacts: [Final requirement/evidence map](../evidence/11-completion.md), browser/identity/UI/manual/contrast/capability/performance/cleanup receipts, focused test runners/auth regressions, auth source, test-only cache subscription, FRONTEND and bilingual deploy-frontend pages, canonical plan/master/session state.
- Verification: Pinned toolchain web/root types, lint, scoped format, build, auth5/foundation6 unit cases, secret scan and docs build pass. Real Node/PostgreSQL18.6/Chrome155 login/reload/recovery/revocation and Staff→User/logout/denial/expiry draft/cache clearing pass; user reports manual Safari/VoiceOver/keyboard/zoom/touch-emulation/motion/navigation all pass. Actual workerd/Miniflare/D1 Minimum document drives UI with only instance GET; client capability fault injection is explicitly classified. Final local cold sample: LCP88ms/FCP48ms/CLS0/lab interaction candidate40ms, initial JS371879 raw bytes/113993 gzip bytes, no long tasks/CSP violations, lazy routes verified. These are baselines, not field INP or SLOs.
- Decisions and deviations: No native computer-use tests after user steering; manual receipt is trusted user evidence, installed Safari27.0 metadata is separately sourced. No physical mobile/Firefox/full-AT claim. Late-exchange test initially replaced a captured transport and timed out; changing its mock implementation in place resolves the fixture without extending timeout. Cache indicator uses a subscription under React Compiler. No dependency/backend/policy/gate relaxation.
- Blockers/open questions: None within Module 11. Existing global backend/release/13.G6 gaps remain outside scope.
- Next actions: Commit B3; no push/PR edit or next-module work. Any Module 12 start requires separate scope/prerequisite decision.
- Next-session cautions: [Cleanup](../evidence/11-local-cleanup.json) independently verifies exact certificate/trust removal with preserved originals, process/four listeners/private files absent and temporary UI/trace removed; private cluster wrapper exits0 and Minimum emulator/static child disposed. Protected root drafts/handoffs remain untracked; G1 Not passed and Module 10 Blocked must not be inferred otherwise from frontend completion.

Final closure checks: 422 scoped relative links, all22 canonical checks, retained G1/Module10/13.G6/Module12 states, evidence JSON/manual/cleanup/bilingual assertions, secret signatures and git diff --check pass. Final VitePress1.6.4 docs build passes. Web/root types, scoped lint/format and final production build pass; auth5 and foundation/plugin6 pass in their focused runs. B1 commit59c5690 and B2 commit55cb982 are local; B3 is prepared for its separate commit. No remaining Module 11 blocker or owned local service/certificate/private fixture remains.


### 2026-10-18 — Module 12 prerequisite checkpoint

- Scope and checklist IDs: Module 12 auth/config/presentation prerequisites; user-directed Module 12 completion and explicit audit-browsing resume.
- Progress: Added optional exact uploadOrigins and the corresponding storage/isolated-media connect-src entries; BrowserAuth retains private memory credentials while providing fixed-path isolated-media downloads and clear passkey step-up notices. Route drafts are keyed by identity epoch and pathname. Existing focused auth/foundation checks pass; broader new product checks belong to Module 12.
- Change summary: See [Module 12 checkpoint](12-web-product-workflows.md) and [workflow contract decisions](../evidence/12-workflow-contracts.md).
- Files/artifacts: Shared contracts/server/runtime roots or frontend boundary files described in the linked checkpoint; [ADR 0016](../../decisions/0016-first-party-passkey-step-up-controls.md) for the first-party ceremony controls.
- Verification: Local workerd/D1 and PostgreSQL issue-route suites 2/2 each, focused frontend 16/16, public contracts 2/2 and builds pass at recorded checkpoints; newest passkey/browser work remains under verification. No hosted acceptance.
- Decisions and deviations: No dependency, database migration, weakened assurance, persistent browser credential, raw HTML sink or hosted load.
- Blockers/open questions: New browser acceptance/review remains owned by Module 12; G1/Module 10/13.G6 status unchanged.
- Next actions: Complete the linked Module 12 verification and record final prerequisite results here.
- Next-session cautions: Preserve protected user drafts and earlier evidence; this increment does not imply new hosted/release acceptance.


### 2026-10-18 — Module 12 browser recovery checkpoint

- Scope and checklist IDs: Necessary existing prerequisites for Module 12; no new owning-module checklist closure.
- Progress: Updated frontend state/config/research guidance and synchronized English/Chinese account/project/frontend-hosting guides. Unique IDs, draft boundaries, lazy chunks and current build evidence supplement foundation behavior without reopening its completed checklist.
- Change summary: Draft/form/conflict and plugin control fixes, separate revocation explanations, current local verification and reader/engineering documentation.
- Files/artifacts: [Module 12 acceptance record](../evidence/12-browser-acceptance.md), linked profile reports/bundles and its [progress](12-web-product-workflows.md); scoped source formatting only on existing prerequisite files.
- Verification: Node 31, Standard 31 and Minimum 32 local browser checks pass; focused unit 18/18, contracts 2/2, workerd HTTP 2/2 and PostgreSQL HTTP 2/2. Typecheck/lint/boundaries/build/secret/docs checks pass at recorded checkpoints.
- Decisions and deviations: No new migration/dependency or policy weakening. See the linked record for failed harness assumptions and the fixture key-registry correction.
- Blockers/open questions: Remaining Module 12 upload/media, failure/accessibility/performance/security acceptance stays open.
- Next actions: Continue the bounded Module 12 acceptance matrix; preserve this module's existing gates and incomplete checks.
- Next-session cautions: No hosted traffic, paid resources, push, merge or later-module work. G1 Not passed, Module 10 Blocked, 13.G6 open; protected root drafts remain uncommitted.

### 2026-10-19 — Module 12 actual upload and accessibility checkpoint

- Scope and checklist IDs: Necessary existing prerequisites for 12.2c/12.V2/12.V5; no reopening of this module's completed checklist.
- Progress: [Module 12 upload evidence](../evidence/12-upload-acceptance.md) now records actual local Node 11, Standard 10, Minimum 10 browser checks, including scanning, quarantine/release and isolated media. [Core acceptance](../evidence/12-browser-acceptance.md) records explicit reload race recovery and three zero-violation automated accessibility reports.
- Change summary: Product transfer renewal/status, ordinary attachment-link controls, safe-tree checkbox names and fetched edit baselines. Frontend guidance and English/Chinese hosting pages synchronized. All-owned-resource cleanup and manual stop verified.
- Files/artifacts: Linked Module 12 reports/progress and its frontend/test fixtures; no migration/dependency change.
- Verification: Latest core browser Node 31, Standard 31, Minimum 32; typecheck/lint/boundaries pass, focused state/passkey 7/7. Manual observations and final review pending; no production provider/scanner or hosted acceptance.
- Decisions and deviations: Genuine local SeaweedFS/ClamAV and native workerd/D1/R2 are distinguished from Miniflare test signing/CORS. No weakened policy.
- Blockers/open questions: Module 12 manual WCAG/performance/security and remaining workflows stay open.
- Next actions: Complete remaining Module 12 evidence and synchronize final prerequisite notes.
- Next-session cautions: Live manual fixture must remain available until human testing finishes; do not rebuild shared dist or reuse stale URLs. G1 Not passed, Module 10 Blocked, 13.G6 open; protected user drafts untouched.


### 2026-10-19 — Module 12 prerequisite closure

- Scope and checklist IDs: Final local verification/documentation of this module's bounded Module 12 prerequisites; no additional owning-module checklist/gate closure.
- Progress: Module 12 is Complete; its [24-item completion map](../evidence/12-completion.md) supersedes earlier pending Module 12 notes in this log.
- Change summary: Final expiry/conflict/moderation/forms/first-party passkey checks, actual upload/media acceptance, human accessibility acceptance, focused review and measured performance are reconciled. No new prerequisite behavior during this documentation closure.
- Files/artifacts: Module 12 completion/browser/upload/performance/review reports, ADR 0016, its checklist/progress and synchronized English/Chinese reader guidance.
- Verification: Final local workflows 37/37/38, uploads 11/10/10, zero axe violations on nine surfaces/profile, user manual all-pass. Current-source units 18/18, contracts 2/2, workerd HTTP 6/6 and PostgreSQL HTTP 6/6; types/lint/API/build/docs/secrets/scoped format/whitespace pass. Final documentation checks are in Module 12's closing record.
- Decisions and deviations: Human/manual, local genuine service, native emulator and instrumented lab scopes remain distinct. No production/provider/billing/hosted compatibility claim or security-policy relaxation.
- Blockers/open questions: No Module 12 remainder. This module's pre-existing incomplete gates/checks and production provider/scanner remainders are unchanged; G1 Not passed, Module 10 Blocked and 13.G6 open.
- Next actions: Follow this module's existing authorized scope; do not restart hosted/later-module work from the Module 12 closure.
- Next-session cautions: Owned Module 12 services are stopped; manual URL obsolete and scanner snapshot expires normally. Protected drafts/handoffs remain uncommitted; no push/merge/PR edit or hosted resource action.
