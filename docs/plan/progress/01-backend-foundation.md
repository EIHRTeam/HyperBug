# 01 progress — Backend workspace and runtime foundation

Plan: [Detailed checklist](../modules/01-backend-foundation.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress
- Delivery scope: MVP backend
- Prerequisites: 00 complete; G0 passed.
- Implementation started: Yes.
- Completed implementation checklist IDs: 01.1a–01.1e, 01.2a–01.2f, 01.3a–01.3e, 01.V1–01.V3.
- Active/next checklist group: 01.3f and 01.V4, the post-completion SAST increment added on 2026-09-18. The original foundation acceptance remains met; these two items are open, so the module is no longer Complete.
- Last updated: 2026-10-03 (Module 07 scanner-hook integration follow-up).
- Blocking issues discovered: None remaining for the original phase acceptance. An earlier intermittent Node reset remains recorded; later local, clean-checkout and hosted runs pass.
- Evidence: [Local foundation validation](../evidence/01-foundation-validation.md). The SAST increment has local configuration validation only; no hosted run exists yet.

## Step tracking

| Step | Purpose                                      | State    | Evidence                                              |
| ---- | -------------------------------------------- | -------- | ----------------------------------------------------- |
| 01.1 | Resolve the toolchain and package boundaries | Complete | [Validation](../evidence/01-foundation-validation.md) |
| 01.2 | Prove shared Elysia runtime behavior         | Complete | [Validation](../evidence/01-foundation-validation.md) |
| 01.3 | Make development and CI repeatable           | Complete | [Validation](../evidence/01-foundation-validation.md) |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Retain the scoped workspace/lockfile commit for 01.1c, preserving unrelated concurrent work.
2. Retain the passing heartbeat/request-signal proof for 01.2f.
3. Retain the passing hosted run and extend these checks as later authorized backend modules are implemented.

## Next-session cautions

Use the pinned Node/Corepack command and separate runtime test processes. The foundation source and single lockfile are in the scoped implementation commit; preserve uncommitted root documentation, install.sh and module 07 policy work from other tasks. Local passing tests do not prove hosted CI or live cloud/S3 deployment. workerd disconnect detection requires a subsequent write; preserve heartbeat/deadline bounds.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 01; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for backend workspace and runtime foundation.
- Files/artifacts: `docs/plan/modules/01-backend-foundation.md`; `docs/plan/progress/01-backend-foundation.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 01.1.
- Next-session cautions: Verify installable versions and Elysia adapter package names. Source version snapshots are not an installation lockfile.

### 2026-09-17 — Guidance prerequisite completed

- Scope and checklist IDs: Readiness handoff from module 00; no module 01 implementation checklist item executed.
- Progress: Module 00 is complete and G0 has passed; this module is now Ready.
- Change summary: Updated eligibility and next-action status without installing packages or scaffolding a backend.
- Files/artifacts: This progress record and master status; see [module 00 evidence](../evidence/00-guidance-validation.md) for the two registered skills.
- Verification: Inspected both skills, root registration, and the module 00 validation report. No module 01 build/runtime checks were run; the workspace has no package manifest or application yet.
- Decisions and deviations: Retained the planned backend-first sequence and both production profiles.
- Blockers/open questions: Required package availability and Elysia adapter names remain unverified until 01.1.
- Next actions: Read root AGENTS and hyperbug-development, then execute 01.1a and record current version/documentation evidence.
- Next-session cautions: Do not recreate guidance or infer backend completion from G0. The source version snapshots are not a lockfile; use only commands supported by the actual workspace/tooling.

### 2026-09-17 — Foundation implementation started

- Scope and checklist IDs: Initial batch 01.1a–01.1e and 01.2a–01.2e; then runtime verification and repeatable commands in 01.3.
- Progress: G0 verified; inspected working tree and source policies. Required major versions are published.
- Change summary: Began toolchain/runtime research before workspace implementation.
- Files/artifacts: This record; implementation and evidence will be added at the next checkpoint.
- Verification: Registry confirms TypeScript 7.0.2, pnpm 11.26.0, Elysia 1.4.30, Vitest 5.0.1. Node 24.21.0 and PostgreSQL 18.6 are installed locally. Context7 resolve/query completed for Elysia, pnpm, TypeScript and Vitest.
- Decisions and deviations: Use Node 24 explicitly because the ambient shell is Node 26. Preserve the existing untracked `.node-version` containing `24`. No baseline deviation.
- Blockers/open questions: Elysia documentation adapter-name ambiguity is being resolved against published exports and actual execution. Python's local CA configuration rejected registry TLS; use validating Node/npm clients rather than disabling TLS.
- Next actions: Create workspace and shared application; prove equivalent behavior on Node and workerd before advancing dependent persistence work.
- Next-session cautions: No SPA or feature/auth endpoints are authorized by this batch. Initial git state had only an untracked `.node-version`.

### 2026-09-18 — Workspace and shared HTTP checkpoint

- Scope and checklist IDs: 01.1, 01.2, 01.3a–01.3e, 01.V1–01.V3.
- Progress: Created 13-package workspace, exact lockfile, shared Elysia application, two composition roots, configuration/telemetry ports, boundaries, CI definition and runtime suites. Initial 17-test suite passed after compatibility fixes; stronger cancellation cases remain under investigation.
- Change summary: Added bounded JSON parsing (including chunked input), safe parser-error unwrapping, unique request IDs, no-store health responses and startup validation. Proved TypeScript 7 checks and both builds. Added isolated PostgreSQL test-cluster runner.
- Files/artifacts: `apps/`, `packages/`, `tests/`, `tooling/`, root workspace/config files, `.github/`, [toolchain research](../../development/TOOLCHAIN.md), [runtime ADR](../../decisions/0001-runtime-foundation.md).
- Verification: Typechecks and builds passed on Node 24.21.0. Initial Node/workerd HTTP suite passed; strengthened suite currently proves 15/16 cases (stream cancellation propagation in the older workerd harness fails). Known credential signature and reviewed license inventories passed. Audit found 2 high / 5 moderate advisories in old Miniflare/Drizzle tooling; replacing Miniflare with the exact current Wrangler-aligned runtime before acceptance. No hosted CI or cloud deployment performed.
- Decisions and deviations: TypeBox ESM/CJS unique-symbol mismatch is bridged at the Elysia boundary with `t.Unsafe<DTO>(existingSchema)` preserving the actual schema and runtime validation. Node adapter 1.4.6's unset `app.server` requires using its callback's real listener for port/lifecycle control; guarded in the composition root. pnpm 11 defaults to implicit install before scripts; set `verifyDepsBeforeRun: error` and install explicitly. An unrelated embedded global pnpm uses Node 24.19/pnpm 11.19, so local commands use `fnm exec --using=24.21.0 corepack pnpm`.
- Blockers/open questions: Verify current Miniflare cancellation behavior and audit remediation. Container runtime is unavailable and Docker registry requests timed out; do not claim local S3 service verification yet.
- Next actions: Finish stronger runtime and production-entry tests, update dependency/license evidence, provide local S3/PG service setup, then unlock module 02 persistence.
- Next-session cautions: Keep goal active. Files are uncommitted. Preserve other tasks' root documentation changes (AGENTS, README, CLAUDE, CONTRIBUTING, PRIVACY and translated files). No SPA or later feature endpoints.

### 2026-09-18 — Runtime, local storage and verification checkpoint

- Scope and checklist IDs: 01.2d–01.2f, 01.3a–01.3d, 01.V1–01.V3.
- Progress: Added production-entry smoke tests, dependency-readiness failure/timeout cases, and a loopback S3-compatible test service. Both runtime suites passed together once; a later Node cancellation run exposed an intermittent connection reset and remains under investigation.
- Change summary: Local storage uses pinned Miniflare R2's S3 endpoint, random per-process credentials, protected local configuration, persistent development storage and disposable test storage. Added signed PUT/HEAD/GET/DELETE plus invalid-signature tests. Bounded JSON cleanup cannot extend a deadline when stream cancellation never settles. CI now includes contract and PostgreSQL jobs.
- Files/artifacts: `tooling/local-s3.ts`, `tests/{node,workerd}/entry.test.ts`, `tests/workerd/storage.test.ts`, HTTP fixtures, `tests/unit/bounds.test.ts`, workflow and workspace commands.
- Verification: Frozen install, both TypeScript configurations, both builds, formatting, lint/boundaries, known-signature scan and reviewed license scan passed. High-severity audit passed with one documented moderate Drizzle Kit development-only advisory. Full suite passed with 59 normal successes plus one expected workerd disconnect failure before the cleanup refinement; newest unit/contract suite has 10 successes. A subsequent Node cancellation probe failed once with ECONNRESET and its focused rerun passed; this is not yet accepted as stable runtime evidence. No hosted CI/cloud run.
- Decisions and deviations: Context7 resolve/query for Miniflare/Workers SDK did not cover the experimental S3 credential option; verified installed 5.20260916.0-alpha declarations/source and actual signed protocol requests instead. Test service is package-based; no container/image or live-provider compatibility is claimed.
- Blockers/open questions: Workerd incoming-disconnect notification remains unresolved. Investigate intermittent Node cancellation/reset before accepting 01.2f. Hosted CI remains unexecuted.
- Next actions: Diagnose cancellation with connection-level evidence; complete an isolated clean-install check, record runtime evidence and update canonical checkboxes only for verified outcomes.
- Next-session cautions: Use `fnm exec --using=24.21.0 corepack pnpm`; isolate runtime Vitest processes. Do not expose test routes, credentials or local S3 infrastructure. Preserve unrelated root documentation changes; all application work is uncommitted.

### 2026-09-18 — Reproducibility and current runtime handoff

- Scope and checklist IDs: 01.1, 01.2, 01.3, 01.V1–01.V3.
- Progress: The foundation, documented local services, scans and both builds work from a clean isolated source copy. Remaining phase acceptance is the recorded disconnect gap and hosted CI; the single lockfile is prepared but still uncommitted.
- Change summary: Added safe local D1 migration wiring and regenerated binding types, PostgreSQL migration operations, full database lanes, body-free list reads and persistent evidence reports. Current toolchain and commands are documented, including the native PostgreSQL/package-based local S3 setup.
- Files/artifacts: Workspace/app/tooling/test files; workflow; [validation evidence](../evidence/01-foundation-validation.md); development and migration documentation; paired module 02 record.
- Verification: Isolated source copy with no node_modules passed offline frozen installation, both TypeScript configs, both builds and all four separate test lanes (77 ordinary successes and one expected workerd disconnect failure before two later database-only regression cases). Working-tree format/lint/history/scans pass. Audit has one reviewed moderate dev-tool advisory and no high findings. Five focused Node HTTP reruns and both later full runs passed after the earlier intermittent reset; its cause remains unproven. Context7 verified the documented GitHub PostgreSQL service/health/port pattern; hosted CI is still not executed.
- Decisions and deviations: Local native PostgreSQL 18.6 and pinned Miniflare S3 protocol replace no production provider; they are explicitly scoped test infrastructure. CI's proposed PostgreSQL image is recorded but not claimed tested. The optional Elysia next lane remains deferred pending stable runtime acceptance. No SPA/client web work occurred, so no new modern-web guide lookup was needed.
- Blockers/open questions: 01.2f cannot close with the expected failure still present. Required hosted CI evidence is absent. 01.1c's committed-lockfile condition is not yet met; coordinate a scoped commit without including unrelated concurrent work.
- Next actions: Complete checklist/documentation consistency, prepare the isolated implementation commit, resolve or reproduce runtime disconnect limitations on the required target, and run hosted CI when that coherent branch is available.
- Next-session cautions: Preserve AGENTS/README/Claude/privacy/contribution/translations, install.sh and the independently authored module 07 policy/plan edits. Do not claim a deployed Worker, live S3 provider or complete phase 01 from a green process containing an expected failure. Goal remains active.

### 2026-09-18 — Disconnect diagnosis and committed foundation preparation

- Scope and checklist IDs: 01.2f runtime proof, 01.1c scoped commit, 01.3b hosted CI acceptance.
- Progress: Resolved the local disconnect failure. Both runtime HTTP suites and the full suite now pass without expected failures.
- Change summary: The previous idle stream never wrote after client disconnection. A bounded 50 ms heartbeat lets workerd detect the closed peer; the shared test now explicitly checks incoming request abort as well as cooperative cleanup. Added an Elysia-free direct-socket reproducer and documented the observed timing. Added migration-history validation to CI quality checks.
- Files/artifacts: `tests/fixtures/{http-contract,proof-app}.ts`, `tests/workerd/http.test.ts`, `tooling/probe-workerd-disconnect.mjs`, workflow, ADR 0001, development documentation and [validation evidence](../evidence/01-foundation-validation.md).
- Verification: Context7 resolved/queried the current Cloudflare Request docs on 2026-09-18. Bare probe passed: with 500 ms heartbeats no abort at 100 ms, then abort on the first write; 50 ms heartbeat delivered abort before the 100 ms observation. Focused Node/workerd HTTP suites passed nine cases each. Current-tree typecheck/lint and full suite passed: 10 unit/contract, 10 Node, 36 workerd and 24 PostgreSQL; 80 ordinary passes, zero expected failures.
- Decisions and deviations: Preserve all required runtime/profile/version choices. Streaming disconnect detection is write-driven; future streams need bounded heartbeats and deadlines. The previous idle-stream observation remains recorded and is not treated as an upstream fix. The earlier intermittent Node reset has not recurred here; no root cause is claimed.
- Blockers/open questions: Required hosted CI and committed-lockfile evidence still pending at this checkpoint.
- Next actions: Create the scoped implementation commit, verify it independently of unrelated changes, and run the required hosted CI lanes.
- Next-session cautions: Preserve concurrent root documentation, install script and module 07/12 policy changes. G1 remains closed. Do not deploy proof routes or infer live provider compatibility from local tests.

### 2026-09-18 — Committed clean-checkout and hosted acceptance

- Scope and checklist IDs: Final completion audit of modules 01 and 02, including 01.1c and required CI acceptance.
- Progress: Both phases are Complete. Implementation commit `bcd417c9dc8b19a3476a4d7f0b4645d827ae742d` is published on `codex/phase-01-02`; no merge or deployment was performed.
- Change summary: Retained a scoped commit, independently validated its clean checkout, ran hosted quality/runtime/database jobs, and mapped every checklist ID to inspected evidence. Updated current status and handoff documentation; historical failed observations remain visible.
- Files/artifacts: Module 01/02 plans, progress and evidence reports; development guides, ADR 0001 and public specifications. [Hosted run 35347249101](https://github.com/EIHRTeam/HyperBug/actions/runs/35347249101). Unrelated root and content-policy work is excluded from the commits.
- Verification: Committed clean checkout passed offline frozen installation, both typechecks/builds and 80 tests; 15 foundation documents passed 98 local links/anchors. Hosted quality, Node, workerd and PostgreSQL jobs all passed with the same 80 tests and no expected failures. Hosted PostgreSQL 18.6 image/version was confirmed in the log. Quality passed migration histories, lint/format, scans and audit high gate; one reviewed moderate dev-tool advisory remains.
- Decisions and deviations: No baseline/gate relaxation. Workerd disconnect proof includes heartbeats and explicitly observes Request.signal. The required matrix passes on macOS locally and Linux in CI. Optional Elysia next remains deferred. G1 stays closed.
- Blockers/open questions: None remaining for these phases. Production/provider acceptance, feature authorization and SPA gates belong to later modules. Earlier Node reset has not recurred in the verified runs; no root-cause fix is claimed.
- Next actions: Hand off the completed foundation; use the plan's next eligible backend module only when authorized. Preserve and extend the required checks.
- Next-session cautions: Keep migrations immutable after shared application, use Node/Corepack pins and separate runtime processes, preserve unrelated uncommitted work, and never deploy fixture routes or treat repository integrity as authorization.

### 2026-09-18 — CodeQL SAST increment and commit convention

- Scope and checklist IDs: 01.3f and 01.V4, both added by this session. Also anchored the repository commit convention in `AGENTS.md`. No previously completed item was reopened or re-scoped.
- Progress: Added CodeQL code scanning for first-party JavaScript/TypeScript as the SAST layer that `01.3b` does not cover. `01.3b` already satisfies SECURITY §127 with dependency (`pnpm audit`), secret (`scan:secrets`), and license (`scan:licenses`) scanning, and §127 itself does not request static analysis, so this is deliberately an extension of the module rather than a corrected omission. Both new items are left unchecked: the workflow has not run on a hosted runner.
- Change summary: Added `.github/workflows/codeql.yml` from the GitHub advanced-setup template with the language matrix populated as `javascript-typescript` / `build-mode: none`; the template referenced `matrix.build-mode` without defining the key, so the value had to be set explicitly. Exposed `opened`, `synchronize`, and `reopened` under the `pull_request` trigger; these are already the defaults, so behavior is unchanged and the intent is now auditable in the file. Removed the template's `schedule` trigger at the user's direction, so analysis now runs only on a commit to `main` or on pull-request activity. Left the default query suite in place with `security-extended` still commented out. In `backend.yml`, `actions/checkout` and `actions/setup-node` moved from v4 to v7, and `node-version` changed from the exact `24.21.0` to `24`. Recorded the Conventional Commits rule in `AGENTS.md` since no commit convention existed in `EXECUTION.md` or any hook.
- Files/artifacts: `.github/workflows/codeql.yml` (new); `.github/workflows/backend.yml`; `AGENTS.md`; `docs/plan/modules/01-backend-foundation.md`; `docs/plan/progress/01-backend-foundation.md`; `docs/plan/PROGRESS.md`. Commits on `feat/v1`: `8655cee` (commit convention), `1b6e54e` (workflow action bump), `873b718` (CodeQL workflow), `336ef86` (explicit PR trigger).
- Verification: YAML parsed and asserted for triggers and matrix; after the schedule removal the only triggers are `push` and `pull_request`, with no cron left in the file, and every `matrix.*` reference resolves to a defined key. `actions/checkout@v7`, `actions/setup-node@v7`, and `github/codeql-action@v4` tags all resolve through the GitHub API. Live repository state read with `gh`: `code-scanning/default-setup` reports `not-configured` with query suite `default`; `branches/main/protection` reports `Branch not protected`; the repository is public and `default_workflow_permissions` is `write`. The four commit subjects match the newly documented pattern. **Not run:** no push or pull request occurred, so no hosted CodeQL analysis exists and `01.V4` is unsatisfied. Fork pull request behavior for `security-events: write` was not reproduced and is not claimed.
- Decisions and deviations: Chose a committed workflow file over repositories-settings-only default setup so the configuration is reviewable and versioned and so the extra `security-events: write` scope stays job-local; `backend.yml` keeps its `permissions: contents: read` posture and was not modified for this. Kept CodeQL advisory by leaving `main` unprotected at the user's direction, so findings will not block merges. Kept the default query suite until real findings are reviewed. Dropped the template's scheduled scan at the user's direction: this accepts that no analysis runs while the branch is dormant, so a newly shipped CodeQL query or a newly disclosed vulnerability class will not surface until the next push or pull request. The rationale is recorded in the workflow itself so the omission is visible rather than looking like an oversight. This session was driven by Context7 lookups against `/github/docs`, `/websites/github_en_code-security`, and `/websites/github_en_actions`; the CodeQL query-suite and default-activity-type statements come from those retrievals rather than memory.
- Blockers/open questions: `01.V4` cannot close without a hosted run, which needs the workflow pushed to `main` or opened as a pull request targeting it. `01.3f` stays open on the same evidence. Whether the CodeQL job needs an explicit top-level `permissions: contents: read` remains an open hardening question, because this repository's default workflow permission is `write`.
- Next actions: Push to `main` or open a pull request targeting it, then confirm the CodeQL job runs and its results reach the Security tab, which closes `01.V4` and `01.3f`. Afterwards consider requiring the CodeQL check on `main` and reviewing whether `security-extended` is worth its lower precision.
- Next-session cautions: The triggers are limited to `main`, so pushes to `feat/v1` do not run CodeQL. There is no scheduled scan, so a dormant `main` receives no new analysis until a commit or pull request arrives. `main` has no branch protection, so scanning is advisory only. `node-version: 24` in `backend.yml` is now a floating minor rather than the previous exact pin, bounded by `engines.node` in `package.json`. The default query suite is active and `security-extended` remains commented out. `.github/**` and `AGENTS.md` fall outside the paths covered by `pnpm format:check` and Biome, so those checks do not guard them. No ADR and no `TOOLCHAIN.md` lookup record were written for this increment.

### 2026-09-18 — Build and lint/format migration assessment

- Scope and checklist IDs: Investigation only, requested against the tooling decisions recorded for `01.1c` and `01.3a`. No checklist item was added, reopened or marked complete, because nothing was migrated and no new evidence about the current implementation was produced.
- Progress: Assessed two proposals. (1) Migrating `tooling/build.mjs` from esbuild to tsdown/rolldown is feasible and was demonstrated with a read-only probe: rolldown 1.2.9 built both real entries, the Node artifact served `/health/live` and `/health/ready`, and the rolldown and committed esbuild Cloudflare artifacts both initialized in Miniflare and answered `/health/ready` 200 with `/_proof/*` still 404. Three measured adoption items were recorded: single-file outputs need `output.codeSplitting: false` or the tests' `dist/node/index.mjs` contract breaks (a real build failure was observed), the lazy CommonJS interop changes artifact shape and size (probe Cloudflare artifact 729,529 bytes against the committed 829,484, neither carrying a `node:*` specifier or `pg`), and the two inline esbuild calls in `tests/workerd/*.test.ts` have no plain-rolldown equivalent. (2) Biome cannot yet be the only lint/format tool. With Prettier-equivalent settings its formatter rewrote 1 of 64 files (the leading-operator union in `packages/domain/src/index.ts`), but it cannot format Markdown or YAML, and `format:check` already excludes those 67 drifting files. Rule mapping showed `useImportExtensions` can enforce the extension convention and `noRestrictedImports` can carry the package-level part of the boundary table, while the relative cross-package check still needs `tooling/check-boundaries.mjs`. The assessment, lookup references and explicit not-verified list are recorded in `docs/development/TOOLCHAIN.md`.
- Change summary: Added the build and lint/format migration assessment section to the toolchain research document, including the Context7 references, the registry snapshot (`tsdown` 0.23.0 is still 0.x, `rolldown` 1.2.9, `esbuild` 0.28.2, `prettier` 3.9.8, `@biomejs/biome` 2.5.14 already pinned; both candidates MIT), the measured bundler differences, and the two `biome.json` scope defects (`!!**/migrations` also excludes the two `drizzle.config.ts` files, and `files.includes` silently drops explicitly named CLI paths it does not match). No dependency, lockfile, script, workflow, configuration or artifact was changed.
- Files/artifacts: `docs/development/TOOLCHAIN.md`; this record. Probe configuration and artifacts were created outside the repository (`/tmp/hb-bundler-probe`, `/tmp/hb-fmt-a`, `/tmp/hb-fmt-b`, `/tmp/hb-mini`) and are not deliverables.
- Verification: `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm db:check`, `vitest run --project node` (10 tests) and `vitest run --project workerd` (36 tests) all passed under `fnm exec --using=24.21.0 corepack pnpm` as the unchanged baseline for the comparison, and `format:check` and `lint` were rerun clean after the documentation edit. Both bundlers were invoked read-only through `pnpm dlx`, so `pnpm-lock.yaml` was not touched, and `git status --short` was empty at session start. Bundler evidence came from a probe dependency graph outside the repository plus the Miniflare harness loading the produced ES modules, so it is not a hosted or deployment result. **Not run:** no `tsdown`/`rolldown` install, no `pnpm build` through either tool, no hosted CI, no `test:postgres`.
- Decisions and deviations: Recorded the assessment without adopting either proposal, because a build-tool replacement and a formatter consolidation are separate reversible changes that would each need dependency, lockfile, `allowBuilds` and CI evidence. No ADR was written for an unchanged decision, and no `TOOLCHAIN.md` component row was altered, so the current esbuild/Prettier/Biome choices still read as the accepted baseline. Adopting `tsdown` 0.x would additionally need an explicit `minimumReleaseAgeExclude` decision, which the assessment raises but does not take.
- Blockers/open questions: None. Open for a future authorized increment: whether to adopt `rolldown` directly instead of `tsdown`, how to replace the two inline esbuild calls in the workerd tests, whether Biome should absorb the boundary lint rules and thereby extend enforcement into `tests/`, and whether Markdown/YAML formatting should be added to `format:check` or dropped.
- Next actions: If the build migration is authorized, adopt it as its own increment with the full required suite plus a rolldown-versus-esbuild artifact comparison, and update the `TOOLCHAIN.md` component table, the install policy and `docs/development/README.md` in the same change. If formatter consolidation is authorized, correct the two `biome.json` scope defects first and keep the reformatting commit formatting-only.
- Next-session cautions: The probe results are local and read-only. Do not report either migration as adopted or as CI-validated, and do not assume the probe dependency graph matches a real install. `biome.json` still carries the `!!**/migrations` scope defect, so a future `biome format --write apps packages tooling tests` skips the two `drizzle.config.ts` files until that pattern becomes `!!**/migrations/**`. `format:check` still does not cover Markdown, YAML or `.github/**`.

### 2026-09-18 — Follow-up: full tsdown, Oxc family, safety policy, Zod

- Scope and checklist IDs: Second investigation batch in the same session, still no checklist change. Questions were whether the build can move to `tsdown` completely with multiple chunks allowed, whether the Oxc family can replace the current tools, whether the plan/guidance/skills require type or memory safety, and whether Zod can be introduced.
- Progress: (1) `tsdown` 0.23.0 (rolldown 1.2.9) built both entries with default chunking; the Node artifact stayed a single 138,712-byte file and served both health routes, while the Cloudflare target split into three chunks (598,221 + 125,294 + 1,445 bytes). The multi-chunk Worker entry does run in workerd once every chunk is declared as a module; declaring only the entry fails with `No such module "dist/rolldown-runtime-…"`, so `tests/workerd/entry.test.ts` needs a directory glob or `codeSplitting: false`. Deployment is unaffected because Wrangler bundles from `src/index.ts`. (2) Oxc: `oxlint` 1.83.0 passed the tree with 96 rules, 0 findings in 20 ms and no TypeScript peer; `oxfmt` 0.68.0 rewrote only 1 of 64 source files with Prettier-equivalent options (the same union Biome rewrites) and is the only candidate that also formats Markdown and YAML, though it quotes YAML scalars differently and defaults `sortPackageJson` on. Oxc cannot replace type checking: `--type-aware --type-check` needs the separate `oxlint-tsgolint` binary (7.0.2002) and remains a preview path, so `tsc --noEmit` stays authoritative. ARCHITECTURE §45 already lists `Oxc / Vite native transforms`, `oxlint` and `oxfmt` as the current direction. (3) Safety policy: strictness is enforced through `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, …), `pnpm typecheck` and ARCHITECTURE §46, but no plan, guidance or skill document states a "type safety" or "memory safety" requirement in those words; §45 explicitly rejects "all tools must be Rust". (4) Zod 4.6.5 is compatible — Elysia 1.4.30 accepts `StandardSchemaV1Like` — but ADR 0001 and TECH-STACK §40 fix TypeBox as the single JSON-Schema-oriented contract layer, TypeBox is already an Elysia peer dependency, and one small Zod object schema costs 157,022 bytes bundled (28,225 via `zod/mini`, 170,960 with `z.toJSONSchema`). Recommendation recorded: do not adopt it; revisit only if module 10 (10.1b/10.1e) produces a concrete second-validation requirement, and treat a schema-language replacement as an ARCHITECTURE §49 ADR.
- Change summary: Extended `docs/development/TOOLCHAIN.md` with a follow-up section covering the four answers, the measured sizes and timings, the verified oxlint rule mapping (`eslint/no-restricted-imports` with negated-group allow-lists, `import/extensions` with its presence-only limitation, `import/no-relative-parent-imports`, `import/no-cycle`), and three oxlint configuration traps (single-star globs do not cross `/`; an override replaces rather than merges base rule options; misspelled rule options fail open with exit 0). No dependency, lockfile, script, workflow, configuration or artifact was changed.
- Files/artifacts: `docs/development/TOOLCHAIN.md`; this record. Probes ran in `/tmp/oxc-probe`, `/tmp/oxc-src`, `/tmp/oxc-docs`, `/tmp/oxlint-probe` and `/tmp/hb-bundler-probe`; the repository's only changes are the two documentation files.
- Verification: `pnpm format:check` and `pnpm lint` rerun clean after the documentation edits. Probe commands: `pnpm dlx tsdown@0.23.0 -c tsdown.config.ts`; `pnpm dlx rolldown@1.2.9`; `oxlint 1.83.0` and `oxfmt 0.68.0` from a separate `/tmp` install; `oxlint --type-aware --type-check` with `oxlint-tsgolint` linked; Miniflare loading the multi-chunk Worker entry with all three modules declared (200 with `/_proof/*` 404). Boundary-rule fixtures were applied to a copy of the tree and each expected diagnostic was observed. **Not run:** nothing was installed into the repository, `pnpm-lock.yaml` is unchanged, no hosted CI, no `test:postgres`, and the type-aware run used a copy without workspace links, so it proves the integration starts rather than parity with the `tsc` gate.
- Decisions and deviations: No adoption. `tsdown`/`rolldown`, `oxlint`/`oxfmt` and Zod remain evaluated options with recorded trade-offs rather than accepted dependencies; adopting any of them stays a separate authorized increment with its own dependency, `allowBuilds`/`minimumReleaseAgeExclude` and CI evidence. The safety-policy finding is recorded as a gap in documentation, deliberately without editing the skill or module plan in an investigation-only session.
- Blockers/open questions: None. Open for a future increment: whether to consolidate on `rolldown`, `oxlint` and `oxfmt` (which would also close the Markdown/YAML formatting gap) or keep the current esbuild/Biome/Prettier split; whether the boundary script should become oxlint rules with its negative fixture preserved; and whether explicit safety wording belongs in the module 01 checklist and the development skill.
- Next actions: If tooling consolidation is authorized, do it as one increment that (a) replaces the three tool families together so no rule coverage is lost, (b) keeps a negative boundary fixture that must fail, (c) re-verifies that the Cloudflare artifact still carries no `node:*` specifier, and (d) updates the `TOOLCHAIN.md` component table, the install policy and `docs/development/README.md`. If the safety-wording gap matters, add it to module 01 as a checklist item first.
- Next-session cautions: Do not report any of these tools as adopted or CI-validated. `oxfmt` and `tsdown` are still pre-1.0, so both need an explicit `minimumReleaseAgeExclude` decision rather than a silent install. `oxfmt` reorders `package.json` keys unless `sortPackageJson` is disabled. `oxlint` boundary rules fail open on misspelled options, so never rely on a config without a failing negative fixture. Zod remains unused; the contract layer is still TypeBox per ADR 0001.

### 2026-09-18 — Oxc toolchain migration executed

- Scope and checklist IDs: `01.1c` (shared lint/format settings and lifecycle policy) and `01.3a` (documented workspace commands) were re-verified and refreshed; both remain complete. No new checklist item was needed. The change is the one the two assessment entries above recommended and the user then authorized.
- Progress: Replaced esbuild with `tsdown` 0.23.0/`rolldown` 1.2.9, Biome with `oxlint` 1.83.0 and Prettier with `oxfmt` 0.68.0; `tsc` remains the type checker. `tooling/build.mjs` became `tooling/build.ts`, which owns `dist/`, builds both runtime entry points through tsdown's programmatic API and builds the two workerd fixtures that three test files previously bundled with inline esbuild calls. Workerd resolution and externals moved into `tooling/bundler-options.ts`, target definitions into `tooling/build-targets.ts`, and `tsdown.config.ts` re-exports those targets so the CLI and the script cannot drift. Code splitting is enabled for the deployed Cloudflare Worker (entry plus two chunks, 717,782 bytes total against the previous 829,484-byte single file); `tests/workerd/entry.test.ts` now runs that chunked artifact and declares every emitted module via the new `tests/fixtures/worker-modules.ts`, while `tests/node/entry.test.ts` asserts the Node entry stays a single file. Fixtures are pinned to `codeSplitting: false` because a chunked fixture returned 500 from `/health/ready` while the chunked production Worker returned 200 from an identical module layout. `docs/**` stays outside formatting, so no historical document was reformatted.
- Change summary: Added `tsdown.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`, `tooling/build.ts`, `tooling/build-targets.ts`, `tooling/bundler-options.ts`, `tests/fixtures/worker-modules.ts` and `tests/unit/oxlint-config.test.ts`; deleted `tooling/build.mjs`, `biome.json`, `.prettierrc.json` and `.prettierignore`; updated the build/lint/format scripts, both workerd fixture lanes, the Node entry test, `pnpm-workspace.yaml` (`minimumReleaseAgeExclude` for tsdown and oxfmt; `allowBuilds` keeps esbuild because it remains transitive), and `packages/server/src/bounds.ts` (one scoped `no-await-in-loop` disable with the reason). Recorded the decision in ADR 0004 and marked the superseded tooling paragraph in ADR 0001. Fixed an incidental crash in `tooling/secrets.mjs`, which failed with `ENOENT` on a tracked file that is deleted but not yet committed.
- Files/artifacts: `tsdown.config.ts`, `tooling/build.ts`, `tooling/build-targets.ts`, `tooling/bundler-options.ts`, `.oxlintrc.json`, `.oxfmtrc.json`, `tests/fixtures/worker-modules.ts`, `tests/unit/oxlint-config.test.ts`, `tests/workerd/{entry,http,repository}.test.ts`, `tests/node/entry.test.ts`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tooling/secrets.mjs`, `packages/server/src/bounds.ts`, `packages/domain/src/index.ts` (formatting), `AGENTS.md`, `README.md`, `README_zh-CN.md`, `.github/workflows/codeql.yml` (formatting), [ADR 0004](../../decisions/0004-oxc-toolchain-migration.md), `docs/decisions/0001-runtime-foundation.md`, `docs/development/TOOLCHAIN.md`, `docs/development/README.md`, this record.
- Verification: Under `fnm exec --using=24.21.0 corepack pnpm`: `install --frozen-lockfile`, `typecheck`, `lint` (oxlint 82 rules, 0 findings, plus the boundary script), `format:check` (clean on a second run), `db:check`, `build`, `test:unit` 11, `test:contract` 1, `test:node` 10, `test:workerd` 36, `test:postgres` 24 = 81 ordinary tests, `scan:secrets`, `scan:licenses` all passed. `audit --audit-level high` still reports only the reviewed moderate `drizzle-kit` advisory, unchanged by removing the direct esbuild dependency. Artifact assertions: `dist/node` emits exactly one `.mjs`; `dist/cloudflare` is an entry plus two chunks and starts in Miniflare (entry test 200, `/_proof/*` 404); the Cloudflare output contains no `pg` and no statically linked `node:*` import (the single `node:` string is `file-type`'s computed runtime import). Both YAML files that formatting touched parse. One workerd run failed with `EADDRNOTAVAIL` while a debug Miniflare process from this session was still listening; it passed on rerun. **Not run:** hosted CI, so the previous hosted evidence (produced with esbuild/Biome/Prettier) is superseded and must be re-confirmed.
- Decisions and deviations: Adopted the Oxc direction ARCHITECTURE §45 already records; ADR 0004 owns the decision and ADR 0001's tooling paragraph is marked superseded rather than rewritten. Two deviations from the approved plan: test fixtures are single-file rather than chunked, and the Node/Cloudflare entry tests own their own target builds instead of one shared full build. `tooling/check-boundaries.mjs` is retained rather than ported to oxlint rules, because only path resolution can enforce package-manifest and relative cross-package boundaries; oxlint adds the syntax-level half and `--deny-warnings`. `oxlint --type-aware` is not adopted. `tsdown` 0.23.0 and `oxfmt` 0.68.0 are pre-1.0 and admitted through explicit `minimumReleaseAgeExclude` entries.
- Blockers/open questions: None for the local migration. Hosted CI re-verification is outstanding, and the unexplained chunked-fixture 500 in Miniflare remains unexplained; it is avoided rather than diagnosed and is recorded in ADR 0004.
- Next actions: Push or open a pull request to re-run the quality, Node, workerd and PostgreSQL hosted jobs with the new toolchain, then update the module 01 evidence note. When a real deployment is attempted, confirm the chunked Cloudflare artifact is not needed by Wrangler, which bundles from `src/index.ts`.
- Next-session cautions: `pnpm lint` fails on warnings now, so a new warning is a gate failure rather than noise; intentional sequential awaits belong in `tests/**` or `tooling/**`, where the rule is already off. The oxlint configuration fails open if a rule option is misspelled, so keep `tests/unit/oxlint-config.test.ts`'s negative fixtures passing. `oxfmt` must keep `sortPackageJson: false`, or every `package.json` is reordered. Chunk filenames are content-addressed: never assert them, and never declare only the entry when loading `dist/cloudflare` in workerd. `docs/**` is deliberately excluded from formatting.

### 2026-09-19 — Documentation build dependency and CI increment

- Scope and checklist IDs: Maintenance adjacent to 01.1c and 01.3a, supporting reader documentation under 13.3d; no foundation checklist or gate changed.
- Progress: Added pinned VitePress 1.6.4 and a documentation-only Vite 6.4.3 override, with the shared frozen lockfile and existing install-script controls. Added local docs scripts and a GitHub Pages workflow that builds PRs but deploys only main.
- Change summary: Default-theme bilingual documentation builds independently of API artifacts and the future product SPA. Root quality commands remain unchanged.
- Files/artifacts: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/workflows/docs.yml`, `docs/.vitepress/config.ts`, and [site maintenance notes](../../development/DOCUMENTATION.md).
- Verification: Frozen install, documentation build/config type check, workspace typecheck/lint/format/build, license scan, and high-threshold audit passed. The initial Vite 5 high advisory was removed by the scoped override; only the existing moderate drizzle-kit/esbuild advisory remains. Full outcomes and lookup limitations are in the [module 13 record](13-mvp-release-and-operations.md). No backend behavior changed, and no database/runtime suites or hosted workflow ran for this increment.
- Decisions and deviations: Vue-plugin peer metadata permits Vite 6; VitePress's own Vite 5 range is overridden with explicit local verification and no upstream certification claim. No production frontend stack decision or new lifecycle-script allowlist exception.
- Blockers/open questions: Hosted Pages setup/run is pending; previous module 01 hosted/SAST follow-ups remain unchanged.
- Next actions: Review the shared lockfile and hosted docs build on the next PR; remove the narrow override when upstream supplies a patched supported range.
- Next-session cautions: Keep this documentation toolchain separate from backend and future SPA dependencies. Preserve concurrent module 03 work and previous foundation follow-ups.

### 2026-09-19 — Node rejected-body connection regression found during Phase 03

- Scope and checklist IDs: Reverification of runtime HTTP behavior under 01.2/01.V while implementing 03.1c; existing module 01 hosted/SAST follow-ups are unchanged.
- Progress: Reproduced a six-second ECONNRESET after returning 413 with an incomplete incoming body and reusing the HTTP/1 connection. Added Node-specific rejection cleanup through the shared server's runtime-neutral callback.
- Change summary: Set Connection: close and disable keep-alive only for denied incomplete requests, allowing the safe error to finish before closure. Do not drain unbounded input, add test sleeps/retries or disable all keep-alive.
- Files/artifacts: `apps/api-node/src/{index,rejected-request}.ts`, shared server callback and `tests/node/http.test.ts`; [Phase 03 evidence](../evidence/03-security-foundation-validation.md).
- Verification: Both typechecks, lint/format, complete 99-test matrix and both builds pass. Node's 17 tests include deliberately unfinished Content-Length/chunked bodies using one keep-alive agent and successful subsequent requests. Earlier failure and installed srvx source/doc limitations are recorded in Phase 03 evidence. Hosted CI was not run.
- Decisions and deviations: Preserve the shared Web API/domain boundary; transport primitives remain in the Node composition root. No dependency or baseline change.
- Blockers/open questions: No remaining blocker for this reproduced path; no claim to explain every historical connection reset. Existing hosted/SAST follow-ups remain.
- Next actions: Keep the callback wired as later routes are added; proceed with Phase 03's remaining security scope.
- Next-session cautions: Preserve concurrent documentation/guidance work. Diagnostic tracing was removed; this is an actual cleanup correction, not a timing workaround.

### 2026-09-19 — Security workspace links and generated secret binding types

- Scope and checklist IDs: Maintenance of 01.1/01.2 runtime composition supporting 03.2c; no module 01 acceptance status change.
- Progress: Added `@hyperbug/security` workspace dependencies to both runtime apps and declared `HYPERBUG_KEY_RING` under required secrets for all Wrangler environments. Regenerated binding types using the installed tool.
- Change summary: Secret material remains outside vars/RuntimeConfig. Lockfile changes are exactly two workspace links; external dependency versions and lifecycle policy are unchanged.
- Files/artifacts: Runtime manifests, Wrangler config/generated types, six lockfile lines; [crypto evidence](../evidence/03-security-foundation-validation.md).
- Verification: Lockfile-only update followed by frozen install, generated types, both typechecks/builds, lint/format and 105 tests pass. Latest Workers type definitions were inspected read-only, not installed. No remote secret write, hosted CI or deploy.
- Decisions and deviations: Runtime factories remain separate from core policy and require a lifecycle adapter. No beta-only secret product or dependency upgrade.
- Blockers/open questions: Durable lifecycle composition is pending under 03.2d; module 01 hosted/SAST follow-ups remain unchanged.
- Next actions: Preserve generated binding consistency when the real lifecycle store is connected.
- Next-session cautions: Required secret declarations name bindings only; never put key JSON in vars or logs. Preserve unrelated guidance/docs work.


### 2026-09-19 — Security lifecycle persistence and operations handoff

- Scope and checklist IDs: Runtime/package-boundary support for 03.2d; foundation status unchanged.
- Progress: Both database adapters depend on infrastructure-free security ports without reversing the dependency direction.
- Change summary: Added two workspace links, updated both import policies and negative/positive boundary tests; no external package resolution changed.
- Files/artifacts: Database manifests, pnpm lockfile, `.oxlintrc.json`, `tooling/check-boundaries.mjs`, boundary tests and workerd database fixture.
- Verification: Frozen offline install, both typechecks/builds, lint, secret scan and full 133-test matrix pass. Initial positive lint fixture used an unused import; exporting the type corrected the fixture. Scoped formatting passes; concurrently added `.vscode/settings.json` prevents a clean full-tree format claim.
- Decisions and deviations: Security remains a leaf package; database adapters may implement its ports, while reverse/server imports remain forbidden. No package pin or runtime compatibility flag changed.
- Blockers/open questions: Existing SAST/hosted follow-ups remain separate; no hosted CI was run here.
- Next actions: Continue 03.2e; review any crypto dependency through maintenance guidance before adding it.
- Next-session cautions: Preserve concurrent editor/docs changes and existing runtime transport fixes; database fixture RPCs must never enter production entry points.

### 2026-09-19 — Password dependency investigation support

- Scope and checklist IDs: Module 03.2e candidate/provenance research; no foundation checklist change.
- Progress: Verified current npm metadata for libsodium sumo 0.8.4, hash-wasm 4.12.0 and argon2-browser 1.18.0; no dependency was installed.
- Change summary: Read maintenance dependency policy and recorded audit/static-Wasm/benchmark gaps in [password research](../evidence/03-password-research.md).
- Files/artifacts: Ignored research metadata/README snapshots and module 03 evidence/progress.
- Verification: Context7 and normal TLS-verified registry/source reads; no benchmark/build containing a new package.
- Decisions and deviations: No algorithm selection or package pin change; provenance and safe runtime behavior precede production dependency use.
- Blockers/open questions: Exact independent audit coverage and precompiled Workers loading remain to be established.
- Next actions: Inspect integrity-verified artifacts, then run the bounded both-runtime benchmark.
- Next-session cautions: Keep package pins unchanged until selection is justified; do not run candidate install scripts or weaken crypto parameters as a shortcut.

### 2026-09-20 — Explicit runtime configuration and startup rejection

- Scope and checklist IDs: Runtime-composition support for 03.1e/03.3g; no module 01 checklist or acceptance change.
- Progress: Both production roots and all fixtures explicitly identify their runtime to configuration. Node rejects the Cloudflare-only minimum tier, and shared startup refuses the unfinished tier on either runtime.
- Change summary: Added real bundled startup regressions and adapted loader call sites; no external dependency, lockfile, compatibility flag or binding declaration changed. Archived password research now includes the prior successful static-Wasm probes; further performance exploration was stopped by the user and no probe was rerun.
- Files/artifacts: `apps/{api-node,api-cloudflare}/src/index.ts`, config/server, deployment tests and [tier evidence](../evidence/03-deployment-tier-validation.md); [password archive](../evidence/03-password-research.md).
- Verification: Both typechecks/builds, lint, scoped format, secret scan and affected 104-test matrix pass. Miniflare 5 disposal rethrows failed readiness after cleanup; installed-source verification closed the documentation gap and the regression accepts only the identical startup error during cleanup. No hosted CI, PostgreSQL rerun or deployment.
- Decisions and deviations: Runtime identity is trusted code input, not a provider/env inference. Unaccepted minimum mechanisms remain unavailable behind a shared no-override barrier.
- Blockers/open questions: None for this foundation change; module 01's existing SAST/hosted follow-ups remain separate. Password provenance/implementation is not accepted by successful static loading.
- Next actions: Continue 03.3a audit and remaining tier activation; preserve explicit runtime arguments in future fixture/composition changes.
- Next-session cautions: Preserve unrelated editor/docs/planning work and existing request-rejection transport cleanup. Do not resume stopped password performance probes or count local workerd as a real Free-plan result.

### 2026-09-21 — Audit implementation parked; transport work continues

- Scope and checklist IDs: Support for 03.3a suspension and 03.2f local transport verification; no module 01 acceptance change.
- Progress: Removed only the unfinished audit integrations from active package exports and fixtures; prior accepted foundation behavior remains. Added a bounded loopback Node TLS capability tool.
- Change summary: Preserved the unfinished sources in an ignored local snapshot and kept existing atomic audit writers intact. The transport tool uses installed platform TLS, validates peers and deletes temporary keys.
- Files/artifacts: `.local/phase03-suspended-audit/2026-09-21/` manifest/snapshots; `tooling/transport-probe.mjs`; [transport procedure](../../TRANSPORT-SECURITY.md).
- Verification: After parking audit work, `corepack pnpm typecheck`, `corepack pnpm lint` and `corepack pnpm build` passed. Final transport/document checks are recorded in the module 03 completion entry. No password performance or suspended audit test reran.
- Decisions and deviations: User-directed suspension supersedes earlier audit next actions. Platform TLS capability does not certify an actual deployment or PQ authentication.
- Blockers/open questions: Hosted/deployed transport verification remains open; unrelated module 01 follow-ups are unchanged.
- Next actions: Continue eligible non-audit Phase 03 work and record transport evidence.
- Next-session cautions: Do not restore integrated snapshot files wholesale; they also contain earlier accepted changes. Preserve existing pins and concurrent editor/docs changes.

### 2026-09-27 — Minified production bundles with external source maps

- Scope and checklist IDs: Build-output refinement of the 01.3a toolchain contract. No canonical checklist or verification item describes artifact minification or source maps, so none is checked and no module 01 acceptance status changes.
- Progress: Both `appTargets` now bundle with `minify: true` and `sourcemap: true`, declared once as `productionArtifacts` in `tooling/build-targets.ts`. `tsdown.config.ts` keeps re-exporting those targets rather than restating the options, because `pnpm build` reaches tsdown through `tooling/build.ts`; the pre-change state had no `.map` in `dist/` and a 387,911-byte unminified Node entry, so a CLI-config-only edit would not have produced the requested artifacts. Workerd fixture bundles are deliberately left unminified.
- Change summary: Minification halves the Node entry (387,911 → 190,616 bytes) and removes a third of the emitted Worker JavaScript (1,227,882 → 826,737 bytes across entry, chunk and runtime), with external version-3 source maps that carry `sourcesContent`. `tests/node/deployment.test.ts` now starts the entry with `--enable-source-maps` through a named argument constant; its assertions are unchanged. No dependency, lockfile, script, migration or runtime source file changed.
- Files/artifacts: `tooling/build-targets.ts`; `tsdown.config.ts`; `tests/node/deployment.test.ts`; [toolchain record](../../development/TOOLCHAIN.md); [ADR 0004 amendment](../../decisions/0004-oxc-toolchain-migration.md). Emitted `dist/**` is not committed.
- Verification: Node 24.21.0 on this machine. `node tooling/build.ts` and `pnpm exec tsdown` both emit the same byte counts and the same content-addressed chunk, so the CLI and script paths agree; `typecheck`, `lint` (0 warnings/0 errors, boundaries passed) and scoped `oxfmt --check` pass; test lanes `unit`+`contract` 82/82, `node` 44/44, `workerd` 86/86 and isolated PostgreSQL 18.6 `postgres` 46/46 pass. The minified Node entry was started through the workerd and Node production lanes; no deployment, hosted CI or Cloudflare-platform measurement was performed.
- Decisions and deviations: The options live in the shared target list, not the CLI config, so the two build paths cannot drift. Fixture bundles stay unminified to keep test failures readable; the minified production Worker artifact is still what the workerd entry/deployment lanes start. The Node start command gains `--enable-source-maps`, because without it a startup failure loses its message at a 65,536-byte stderr capture (measured 120,892 bytes, message truncated) while the flag yields 579 bytes with frames mapped to `packages/server/src/turnstile.ts` and `apps/api-node/src/index.ts`. External maps are several times larger than the minified code, so total `dist/` bytes grow even though the executed JavaScript shrinks.
- Blockers/open questions: None for the build contract. Hosted CI has not run against the minified artifacts, and no deployment or real Cloudflare measurement was made; operators must remember the source-map flag on the Node profile.
- Next actions: Re-run the hosted quality/Node/workerd/PostgreSQL jobs when a push or pull request happens, so the minified artifact contract has CI evidence rather than only local evidence. Continue the next authorized backend module.
- Next-session cautions: Do not restate `minify`/`sourcemap` in `tsdown.config.ts`; that reintroduces the drift this entry removed. Keep fixture targets unminified unless a test failure diagnosis story replaces it. If the Node start command is ever committed, it must carry `--enable-source-maps` or startup diagnostics regress. Preserve unrelated concurrent editor/docs/planning changes in the working tree.

### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: 01.1/01.3 toolchain follow-up.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained the pinned dual-profile build, ingress typecheck, lockfile, and local developer commands in scoped commits.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Hosted acceptance for this consolidation was not rerun.
- Next actions: Retain Node 24 and the committed package graph; resume roadmap work only after the hold is lifted.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-09-28 — Workerd runtime import diagnostic repair

- Scope and checklist IDs: Maintain the 01.3a/01.3b shared build and CI contract; no checklist or gate closure.
- Progress: [Workerd job 108947812797](https://github.com/EIHRTeam/HyperBug/actions/runs/36428342535/job/108947812797) passed but repeatedly logged `UNRESOLVED_IMPORT` for the workerd-provided `cloudflare:workers` module. The shared build had a `neverBundle` pattern but omitted that namespace from Rolldown's explicit `external` list.
- Change summary: Applied the existing runtime namespace patterns and Wasm pattern to Rolldown external resolution for production Worker, ingress and fixture targets. ESM still imports `cloudflare:workers`; no runtime behavior, dependency, migration or public contract changed.
- Files/artifacts: `tooling/{bundler-options,build-targets}.ts`, [toolchain record](../../development/TOOLCHAIN.md), this progress record; implementation commit `bb3b320`.
- Verification: Node 24.21.0: `corepack pnpm build` emitted no `UNRESOLVED_IMPORT`; `corepack pnpm test:workerd` passed 103/103 without that diagnostic, including production Worker startup. `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm format:check`, and `git diff --check` passed. Generated `.mjs` files retain `cloudflare:workers` imports. Commit `bb3b320` passed all four hosted jobs in both [PR run 36429420228](https://github.com/EIHRTeam/HyperBug/actions/runs/36429420228) and [push run 36429412599](https://github.com/EIHRTeam/HyperBug/actions/runs/36429412599); the PR Workerd job passed 103/103 with no `UNRESOLVED_IMPORT` or `Could not resolve` in its full log. Context7 resolve-then-query on 2026-09-28 selected [Rolldown external module guidance](https://github.com/rolldown/rolldown/blob/main/docs/in-depth/external-modules.md) and its [external option](https://github.com/rolldown/rolldown/blob/main/packages/rolldown/src/options/docs/external.md); the pinned local build verified the effect.
- Decisions and deviations: Declare only workerd runtime namespaces and precompiled Wasm as external; do not suppress all resolver diagnostics or change the production Worker entry. The earlier log's `UNRESOLVED_IMPORT` was nonfatal but obscured real import failures.
- Blockers/open questions: None for this diagnostic repair; existing unrelated 01.3f/01.V4 work remains open under the scope hold.
- Next actions: Keep new feature work paused.
- Next-session cautions: Preserve the shared build target/fixture resolution contract and Node 24 verification requirement; audit and Argon2id performance work remain paused, Free tier disabled, and no SPA started.


### 2026-10-03 — Module 07 dependency follow-up

- Scope and checklist IDs: Module 07 parser dependencies and runtime fixture/build boundary; no additional owning-module checklist item claimed.
- Progress: Added exact stable platform-neutral parser pins and an explicit Markdown export boundary; no unrelated toolchain/peer upgrade. The ingress bundle remains 6,893 bytes. Existing peer warning is documented in Module 07 evidence.
- Change summary: Supports the authorized Module 07 batch; [full handoff](07-content-and-attachments.md) and [verification evidence](../evidence/07-content-validation.md).
- Files/artifacts: Affected package/fixture paths are inventoried in the linked Module 07 record; no older migration or protected SECURITY.md change.
- Verification: Local unit 199, contract 1, Node 50, workerd/D1 143, PostgreSQL 18.6 82 tests passed; typecheck/lint/format/build/database/docs/license/secret checks passed. Local/emulated storage only; no deployment or remote migration.
- Decisions and deviations: Owning-module status/gates and audit holds remain unchanged; no SPA or Module 09 expansion.
- Blockers/open questions: Module 07's V7 policy-upgrade fixture and forms/storage acceptance remain with Module 07.
- Next actions: Continue the authorized Module 07 goal; no unrelated feature work starts from this follow-up.
- Next-session cautions: All changes remain uncommitted; preserve the protected draft and prior edits, suspended audits, existing migration history and initially clean module-03 measurement snapshots.


### 2026-10-03 — Module 07 format and policy-replacement follow-up

- Scope and checklist IDs: Module 07 YAML dependency/format boundary and actual policy-upgrade runtime fixture; no additional owning-module checklist or gate claimed.
- Progress: Exact platform-neutral yaml 2.9.1 pin and isolated parser export; test-only replacement bundles prove policy/tree/validator changes and cursor continuity on both local profiles. Form API/persistence/storage acceptance remains open.
- Change summary: Supports the authorized Module 07 continuation; [full handoff](07-content-and-attachments.md) and [evidence](../evidence/07-content-validation.md).
- Files/artifacts: Dependency/lockfile, shared boundary/build configuration, form corpus and replacement fixtures are inventoried in the linked Module 07 record.
- Verification: Unit/contract 203, workerd 144, local PostgreSQL 82; type/lint/format/docs/frozen install/license/secret checks passed. All-target build and Node 50 passed (479 final-lane total). Local runtime/service evidence only; no deployment or cloud object mutation.
- Decisions and deviations: Production policy immutable; transform is test-only. Existing peer warning preserved. No audit/SPA/Module 09 expansion.
- Blockers/open questions: Module 07's persistence/APIs/attachment work and real provider tests remain with Module 07.
- Next actions: Continue the current Module 07 goal with the versioned persistence/management/submission batch.
- Next-session cautions: Keep the root SECURITY.md draft protected and all earlier changes; avoid concurrent lint with tests that create negative boundary fixtures; preserve initially clean module-03 measurements.

### 2026-10-03 — Module 07 form/template integration dependency checkpoint

- Scope and checklist IDs: Dependency impact of 07.2a and non-audit form management/submission; no owning-module gate/checklist change.
- Progress/change summary: Shared contracts and both production roots compose immutable content stores, bounded management/history routes and atomic structured issue creation. Added `content:manage` and read-only `content:history` permission rules; existing issue/auth/admission behavior passes the complete regression matrix. New migrations preserve history; no older migration or audit behavior changed.
- Files/artifacts: Owning changes and detailed decisions are inventoried in [Module 07 progress](07-content-and-attachments.md), [specification](../../ISSUE-FORMS.md) and [validation evidence](../evidence/07-content-validation.md).
- Verification: 499 tests passed (unit/contract 204, Node 50, workerd 155, PostgreSQL 18.6 90); typecheck/lint/build/db/docs/license/secret checks passed. This is local runtime/database evidence; no remote migration or deployment.
- Decisions/blockers: Attachment integration remains with Module 07; audit suspension and Module 09/SPA holds remain. G1 stays closed. See the linked record for the detected and corrected PostgreSQL project/receipt lock-order deadlock.
- Next actions/cautions: Continue only the authorized Module 07 goal. Preserve all uncommitted changes and protected SECURITY.md; never resume suspended audit via this dependency record.

### 2026-10-03 — Module 07 portable storage dependency checkpoint

- Scope and checklist IDs: Dependency/runtime impact of 07.3a; no Module 01 gate or suspended item changed.
- Progress/change summary: Isolated R2 and Node S3 adapter packages, shared runtime proof and explicit real-service command. Exact AWS SDK client/presigner 3.1146.0 and aws4fetch 1.0.20; Workers types 5.20261003.1 resolves the existing Wrangler 4.144.0 peer mismatch without relaxing strict peers. SDK code stays out of application/domain boundaries and Node SDK stays out of the R2 bundle.
- Files/artifacts: Manifests/lockfile, adapter packages, boundary/build configuration, storage fixtures/launcher and development guides; detailed inventory in [Module 07 progress](07-content-and-attachments.md) and [storage evidence](../evidence/07-storage-validation.md).
- Verification: 509 full tests passed with real-service cases enabled (209 unit/contract, 54 Node, 156 workerd, 90 PostgreSQL), plus type/lint/frozen install/build/db/docs/format/license/secret/links/whitespace. Native R2 via actual remote binding and real local SeaweedFS proof passed; these are separately classified from emulation and product deployment.
- Decisions/blockers: No default real-service substitution or binary auto-install. R2 S3-scoped credentials/CORS acceptance remains with Module 07. Temporary actual test bucket deleted and absence confirmed. No product deployment/SPA/Module 09 expansion/audit resumed.
- Next actions/cautions: Module 07 intents/finalization batch next. Preserve uncommitted work/protected SECURITY.md; keep peer/lifecycle and exact dependency restrictions. Initially clean generated Module 03 measurements were restored after tests finished.

### 2026-10-03 — Module 07 actual storage and promotion checkpoint

- Scope and checklist IDs: Dependency verification of 07.3i/V3; no owning-module gate/checklist change.
- Progress/change summary: Actual R2 S3/signing/CORS, native local workerd/remote R2 promotion/signing and real local SeaweedFS promotion pass; the shared adapter normalizes quoted S3 part ETags for native R2 completion. Details and private configuration boundaries are in [Module 07 progress](07-content-and-attachments.md) and [storage evidence](../evidence/07-storage-validation.md).
- Files/artifacts: Owning blob adapter/promotion/fixture/command/specification inventory in Module 07; no migration or product deployment in this batch.
- Verification: Current full matrix 517 passed (unit/contract 209, Node 61, workerd/D1 157, real local PostgreSQL 18.6 90); typecheck/lint/db/docs/license/secret/read-only format passed. Provider checks remain distinct from emulator and product deployment evidence.
- Decisions/blockers: R2 signing-credential blocker resolved privately; public attachment lifecycle remains Module 07 work. Audit/SPA/Module 09 holds and G1 remain unchanged.
- Next actions/cautions: Continue only authorized Module 07 persistence/integration; preserve uncommitted work, historical migrations and protected SECURITY.md. No capability or credential in tracked evidence.

### 2026-10-03 — Module 07 upload lifecycle dependency checkpoint

- Scope and checklist IDs: Module 07 composition/build dependency; no new Module 01 acceptance.
- Progress: Independent dependency work verified; [Module 07 checkpoint](07-content-and-attachments.md) owns lifecycle acceptance.
- Change summary: Both roots optionally compose private backend storage configuration and shared upload routes. Node keeps a single production ESM artifact with codeSplitting disabled and targeted directory cleanup; frozen workspace links include the two isolated blob adapters.
- Files/artifacts: Relevant roots/build/manifests, application/contracts/server/database/comment adapters and fixtures; [lifecycle specification](../../ATTACHMENT-LIFECYCLE.md) and [evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final current-tree matrix **541 passed** (unit/contract 209; Node 57 with 9 explicit provider skips; workerd/D1 172; isolated real local PostgreSQL 18.6 103). Typecheck/lint/db history/docs/secrets/licenses/frozen install/format passed; final build details in linked evidence. Existing actual-provider compatibility reused; no deployed lifecycle or scan result claimed.
- Decisions and deviations: ADR 0011; scope remains Module 07 with no suspended audit or Module 09/SPA expansion.
- Blockers/open questions: Multipart/scan/release/content linking/delivery/full cleanup and held dispatch remain with Module 07; no new prerequisite gate opened.
- Next actions: Continue 07.3c multipart intent/capability orchestration, then 07.3d/f–h and attachment-aware 07.2; preserve existing module status/gates.
- Next-session cautions: No commits; protected SECURITY.md and private credentials remain untouched. New migrations append to history. Legacy intents retain quota pending explicit reconciliation; unrelated regenerated Module 03 measurements were restored.

### 2026-10-03 — Module 07 multipart lifecycle integration

- Scope and checklist IDs: Module 07 multipart runtime integration; existing Module 01 acceptance and open SAST items unchanged.
- Progress: Shared multipart routes execute on both existing runtime profiles; no SPA or Module 09 expansion.
- Change summary: Fixture proofs now exercise native emulated multipart parts, completion crash recovery, immutable processing and abort/cleanup through the shared public API. Public composition remains optional and private configuration stays backend-owned.
- Files/artifacts: `packages/server/src/index.ts`, multipart contracts/application services, account/upload proof and both issue-route fixtures; [Module 07 evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final `pnpm test`: 209 unit/contract, 60 Node, 185 workerd/D1, 115 real local PostgreSQL 18.6; 9 optional real-provider skips. All-target build, typecheck and import-boundary lint passed. Storage in the new HTTP journeys is emulated; prior real-provider evidence retained.
- Decisions and deviations: Shared services/routes and infrastructure-isolated adapters preserved. No network/hash work inside database transactions or ordinary file-buffering routes.
- Blockers/open questions: Module 07 scanner/result, production CORS/media, full cleanup and deployment evidence remain open; no change to foundation blockers.
- Next actions: Continue 07.3f/07.2b–d/07.3g/07.3h within existing holds; Module 01 SAST stays separately owned.
- Next-session cautions: No commits/cloud mutation; preserve existing changes and protected SECURITY.md. Do not build runtime fixture outputs during tests or run boundary lint during unit fixture creation.

### 2026-10-03 — Module 07 scanner hook integration

- Scope and checklist IDs: Core scanner hook/runtime integration; foundation status and SAST scope unchanged.
- Progress: Core hooks/persistence/guard behavior locally verified; 07.3f actual scanner acceptance remains incomplete.
- Change summary: Shared handler/DTOs run in both existing runtimes; scanner is unconfigured by default, with no public callback or held dispatcher. Authenticated HTTP fixtures use clearly labeled synthetic verdicts.
- Files/artifacts: Application scan-upload, shared views/contracts, both issue-route/upload proofs; lifecycle evidence. [Detailed validation](../evidence/07-upload-lifecycle-validation.md).
- Verification: Composed regression **598 passed**: 209 unit/contract, 70 Node (9 optional-provider skips), final 195 workerd/D1/R2 emulation and 124 real isolated local PostgreSQL 18.6 with S3 emulation. Scanner verdicts are synthetic. Typecheck/lint/db:check/build/docs/format/secrets/links passed. Initial D1 count failure and corrected-lane commands are recorded in the linked evidence.
- Decisions and deviations: ADR 0011 scanner/result refinement; no provider adapter or dependency change, no audit/Module 09/SPA expansion. Fresh/upgrade preservation verified; only new uncommitted migrations refined before shared deployment.
- Blockers/open questions: Actual scanner/plugin/service/result integration is absent. Module 07 cleanup/discovery, isolated delivery, consumption, production CORS and deployment acceptance remain open.
- Next actions: 07.3f actual scanner evidence; independent 07.3h cleanup/reconciliation and 07.3g delivery; 07.2b–d accepted-state consumption.
- Next-session cautions: No commit/cloud mutation or actual malware-detection claim. Preserve all prior work, protected SECURITY.md/private credentials and old histories. Used quota and held policy are retained until verified physical cleanup.

### 2026-10-04 — Module 07 read-only upload cors tooling

- Scope and checklist IDs: Module 07 partial 07.3c/07.3h; existing module acceptance/holds unchanged.
- Progress/change summary: Added exact-origin CORS preparation/snapshot checking and bounded internal project-local cleanup selection/execution, plus fenced synthetic trusted reconciliation. Both database adapters preserve shared semantics; no migration, provider adapter or dependency changed.
- Files/artifacts: Application upload ports, both upload stores, `tooling/upload-cors.ts`, focused fixtures and [lifecycle evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Full `pnpm test` **609 passed / 9 optional-provider skips** (211 unit/contract, 71 Node, 199 workerd/D1/R2 emulation, 128 real isolated PostgreSQL 18.6 with S3 emulation). Focused dual-store 5 each, unit/Node 11 and six local CLI commands pass; typecheck/lint/db/docs/links pass. Scanner/reconciler callbacks remain synthetic; prior provider acceptance reused.
- Decisions/blockers: No actual scanner, deployed CORS or provider discovery is inferred. Complete cleanup and isolated delivery/consumption remain Module 07 work; scheduling/audit/SPA remain held.
- Next actions: 07.3h actual exact-key discovery adapter evidence, then 07.3g/07.2b–d.
- Next-session cautions: No commit/deployment; preserve older migrations, all prior work, protected SECURITY.md and private credentials.

### 2026-10-04 — Module 07 actual discovery checkpoint handoff

- Scope and checklist IDs: Partial 07.3h; existing owning-module checklist/gates unchanged.
- Progress/change summary: Node upload composition supplies bounded exact-key S3 multipart reconciliation; native Workers remains fail-closed without a discovery adapter. Shared D1/PostgreSQL cleanup/accounting behavior is unchanged from the preceding verified port batch. No migration, dependency or held dispatcher added.
- Files/artifacts: blob-s3 discovery helper/factory, Node upload root, actual-provider/negative fixtures, lifecycle/storage evidence.
- Verification: Final default `pnpm test` **612 passed / 11 optional-provider skips** (214 unit/contract, 71 Node, 199 workerd/D1, 128 real PostgreSQL 18.6). Separate actual R2 S3 and real SeaweedFS discovery **2 passed / 11 filtered skips**; **614 distinct passing checks** composed, with nine other provider checks retaining earlier unchanged acceptance. Final sequential types/lint/build/docs/format/secrets/whitespace pass; initial lint/unit-fixture overlap resolved.
- Decisions/blockers: Complete exact-key pagination/abort/post-abort absence is required; observed SeaweedFS upload-only continuation is preserved without inventing markers. Native Workers composition/full used-file cleanup, actual scanner, delivery/consumption and deployment CORS remain incomplete.
- Next actions: 07.3g/07.2b–d and 07.3h native discovery/full cleanup; actual scanner acceptance remains 07.3f.
- Next-session cautions: No commit/deployment; protected SECURITY.md unchanged, old histories and private credentials preserved. No Module 09/SPA/audit expansion.

### 2026-10-04 — Module 07 atomic form attachment API checkpoint

- Scope and checklist IDs: Module 07 07.2b–d/V2; foundation status/gates unchanged.
- Progress/change summary: Shared submission contract adds explicit draft identity; both backend/API profiles atomically consume current clean released owner/project/draft uploads. Persisted upload association takes priority over stale handler snapshots after linking, including hidden-parent denial. No new composition/dependency/migration/provider/deployment scope.
- Files/artifacts: Shared application/contracts/server and dual database adapters; repository/API fixtures; [Module 07 evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final default matrix **646 passed / 11 optional-provider skips**: 214 unit/contract, 71 Node, 218 workerd/D1/R2 emulation, 143 real isolated PostgreSQL 18.6/S3 emulation. Expanded focus D1 27/PostgreSQL 20; corrected stale-token focus 1 each. Initial aggregate workerd failure and lint's sequential-await annotations are preserved in owning evidence. Actual scanner verdicts remain synthetic; unchanged storage-provider evidence reused.
- Decisions/blockers: Existing schema suffices; actual scanner, isolated delivery, deployed CORS and full cleanup remain Module 07. No SPA, Module 09 or audit expansion.
- Next actions: 07.3g isolated authorized delivery, remaining 07.3h, 07.3c deployment selection and 07.3f actual scanner.
- Next-session cautions: All work uncommitted; no deploy/commit. Protected SECURITY.md and historical migrations preserved; generated Module 03 measurements restored after tests stopped.

### 2026-10-04 — Authorized media and HTTPS checkpoint

- Scope/checklist IDs: Module 07 07.3g/V5 accepted at backend/local transport scope; this module's existing gates/status remain unchanged.
- Progress/change summary: Both roots compose existing attachment reads and explicit media routing; Node optionally loads a bounded private PEM mount, starts native HTTP/1 TLS and passes the actual srvx hostname. Media early-return telemetry uses a fixed route label and matching request ID without auth/cookie routing.
- Files/artifacts: runtime roots, Node TLS/listener, shared server/observability, runtime fixtures; [owning evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final complete default matrix **673 passed / 11 optional-provider skips**: 236 unit/contract, 76 Node, 218 workerd/D1/R2 emulation, 143 real isolated PostgreSQL 18.6/S3 emulation. Focused media unit 22, TLS Node 5 and HTTP 1 per profile. Node media uses certificate-verified local native HTTPS with virtual Host; Workers uses canonical edge URL through workerd emulation. Types/lint/boundaries/build/docs/secrets passed. Provider/migration/dependency evidence reused unchanged; full final handoff checks are in Module 07.
- Decisions/blockers: Current attachment/scan/association and bearer/principal/membership/parent state are rechecked after acquiring storage; held streams are canceled on denial. Actual scanner, installed production CORS/browser evidence and full cleanup/native discovery remain incomplete. No new audit, dispatcher or SPA.
- Next actions: 07.3h/V4 native discovery and explicit used-file/legacy/retention cleanup; 07.3c production selection and 07.3f trusted actual scanner when available.
- Cautions: All work uncommitted; no deployment. Preserve earlier work, historical migrations and protected SECURITY.md. Synthetic clean results never prove malware detection. Generated Module 03 measurements restored after runtime processes ended.


### 2026-10-04 — Module 07 shared/native reconciliation checkpoint

- Scope/checklist IDs: Module 07 partial 07.3h/07.V4; runtime composition only, existing owning-module acceptance/gates unchanged.
- Progress/change summary: Shared application exact-key/page/ID/deadline/abort/absence policy now serves both selected storage roots; Workers uses bounded header-signed R2 S3 discovery beside native CRUD. No schema/migration/dependency/public-contract change.
- Files/artifacts: Application/blob reconciliation, Workers upload root and native/provider fixtures; [Module 07 evidence](../evidence/07-upload-lifecycle-validation.md#native-reconciliation-final-regression).
- Verification: Final default matrix **703 passed / 11 optional-provider skips**: 266 unit/contract, 76 Node, 218 workerd/D1/R2 emulation, 143 real isolated PostgreSQL 18.6/S3 emulation. Related actual R2 S3 + real local SeaweedFS **2 passed**; native local workerd/actual remote R2 **1 passed**. Types/lint/boundaries/build/docs pass; final ancillary in Module 07. Unchanged migration/provider CRUD/signing/promotion evidence reused.
- Decisions/blockers: Manual mode/all-3xx refusal works around native Request redirect error/docs mismatch. Full used-unlinked/legacy/retention cleanup, actual scanner and production installed/browser CORS remain Module 07 work; no scheduler/audit/SPA expansion.
- Next actions/cautions: Continue 07.3h/V4 explicit-policy cleanup. No commit/deployment; preserve earlier changes, historical migrations and protected SECURITY.md. Synthetic scans prove guards only. Generated Module 03 measurements restored after the matrix ended.


### 2026-10-04 — Module 07 verified-unlinked cleanup checkpoint

- Scope/checklist IDs: Module 07 partial 07.3h/07.V4; typed runtime fixture ports, existing owning-module acceptance/gates unchanged.
- Progress/change summary: Required-retention orphan ports/handlers, atomic attachment absence/lease retirement and physical-absence used-byte release on both stores. Finalized immutable identity/guards and late-write tombstones preserved. No schema/migration/dependency/public-route change.
- Files/artifacts: Application/database upload ports, shared/forced race fixture and two typed Node stubs; [Module 07 evidence](../evidence/07-upload-lifecycle-validation.md#verified-unlinked-cleanup-final-regression).
- Verification: Full default **723 passed / 11 optional-provider skips**: 266 unit/contract, 76 Node, 229 workerd/D1/R2 emulation, 152 real isolated PostgreSQL 18.6/S3 emulation. Focus D1 12/PostgreSQL 10 included. Types/lint/boundaries/build/docs passed; final ancillary in Module 07. Blob/scan callbacks are synthetic; actual provider/migration/dependency evidence reused unchanged.
- Decisions/blockers: Do not weaken finalized identity guards to expire retired records; deleted policy/released counters express retirement. Legacy reconciliation/adoption, tombstone retention/compaction and storage deadlines remain Module 07 work, alongside actual scanner and production CORS evidence.
- Next actions/cautions: Continue 07.3h/V4; no commit/deploy/SPA/Module 09/audit. Preserve earlier work, old histories and protected SECURITY.md. Generated Module 03 measurements restored after tests ended.

### 2026-10-04 — Module 07 cleanup waits, legacy inventory and actual scanner environment

- Scope and checklist IDs: Module 07 partial 07.3h/V4 and actual-engine prerequisite 07.3f; foundation gates/SAST scope unchanged.
- Progress and change summary: Shared lease-capped storage caller waits, bounded read-only legacy inventory and preserved runtime/API boundaries. Local ClamAV 1.5.4/signatures now verify; no application scanner or service is configured. No repository dependency/lockfile, runtime composition or migration change.
- Files/artifacts: Application/database inventory/deadline helpers and focused tests; lifecycle/model/plan/evidence; installed official Homebrew local test tool/dependencies and ignored private scanner data. [Owning evidence](../evidence/07-upload-lifecycle-validation.md#bounded-legacy-inventory-2026-10-04); [scanner trust/limits](../evidence/07-scanner-environment-validation.md).
- Verification: Final default **754 passed / 11 optional-provider skips** (287 local unit/contracts, 76 Node/S3 emulation, 234 workerd/D1/R2 emulation, 157 real isolated PostgreSQL 18.6/S3 emulation). Types/lint/import boundaries/all-target build/docs passed. Three actual local detached-signature and two actual engine clean/EICAR checks are separate from the aggregate and from both-profile scan acceptance. Existing actual-provider/migration/repository dependency evidence reused; final ancillary recorded in Module 07.
- Decisions and deviations: Caller timeout is not physical CRUD cancellation; inventory grants no ownership/deletion. Scanner was installed without ClamAV PATH linking, service startup or global configuration; exact official source checksum/root and detached signatures verified without TLS/signature bypass.
- Blockers and next actions: 07.3f bounded configured adapter plus actual both-profile pipeline results; 07.3h/V4 explicit legacy recovery/retained-key compaction; 07.3c selected production installed/browser CORS. No full checkbox closes from prerequisite proof.
- Next-session cautions: All processes terminal, no service runs; generated Module 03 measurements restored. No commit/deploy/SPA/Module 09/audit. Preserve protected SECURITY.md, earlier work and historical migrations. Private databases are a snapshot and do not automatically update.


### 2026-10-04 — Independent actual Node scanner adapter and verification lane

- Scope and checklist IDs: Module 07 partial 07.3f; Node adapter/process lifecycle and explicit runtime verification lane, foundation status/gates unchanged.
- Progress: Independent pinned/signed-read-only ClamAV adapter with one physical process slot, exact streaming bounds, actual closure/temp cleanup, fixed errors and private disposable verification configuration. Runtime roots do not select it; Workers transport remains next.
- Change summary: Added adapter/helper/native subprocess tests, explicit `test:scanner` project/script and actual engine/archive/trust/failure cases; updated lifecycle/development/ADR evidence. No repository dependency, schema/history, public contract, scheduling or production deployment change.
- Files/artifacts: Node adapter/helper, tests/node + tests/scanner + benign archive data, package/Vitest configuration; [owning scanner evidence](../evidence/07-scanner-environment-validation.md#actual-node-adapter-checkpoint).
- Verification: Composed default **767 passed / 11 optional-provider skips** (287 unit/contracts, 89 Node, 234 workerd/D1/R2 emulation, 157 real local PostgreSQL 18.6/S3 emulation). Initial full 766/11 followed by final related Node-only case/full Node 89/11, with unchanged other lanes reused. Native subprocess 13 is included; explicit **actual local ClamAV 1.5.4 lane 15 passed** separately. Final types/lint/boundaries/build passed; final ancillary in Module 07. One actual 30-byte adapter resource sample: 4,476 ms / command max RSS 1,562,705,920 bytes. Earlier provider/migration/dependency evidence reused unchanged.
- Decisions and deviations: Failed 33-MiB nested-ZIP probe revealed silent per-file truncation; selected corrected per-file/PCRE equals the unchanged 128-MiB aggregate cap and passes real supported/over-limit fixtures. Explicit spawn env permits macOS-synthesized locale state but inherits no parent variables. Application/engine limits do not supply OS isolation or cross-instance admission. Focused review remains within authorized implementation and does not resume audit scope.
- Blockers/open questions: Trusted Workers transport, actual both-profile durable result/release/current-authorization/identity cases and production isolation/update/admission policy remain required. CORS/legacy/retention blockers remain in owning Module 07; no full scanner checkbox closes.
- Next actions: Fixed configured trusted scanner service mechanism and actual dual-profile Core journey; independent legacy recovery/retention. Keep 07.3f/07.3c/07.3h/V4 and suspended audits incomplete.
- Next-session cautions: No runtime wiring, daemon, commit/deploy/SPA/Module 09/audit. Tests require a disposable read-only snapshot separate from updater sources; all handles terminal, generated measurements restored and protected SECURITY.md preserved. Actual scanner lane and resource observation stay distinct from default synthetic database scan guards and deployment.

### 2026-10-04 — Private scanner transport and complete actual verification lane

- Scope/checklist IDs: Module 07 partial 07.3f; private runtime adapters/protocol and verification artifacts, foundation/SAST gates unchanged.
- Progress/change summary: Shared exact streaming authenticated internal service, independent Node handler and explicit Workers binding adapter; one native fixture target and actual pipeline lane. `test:scanner` now starts its own isolated PostgreSQL cluster. No production startup, public endpoint, dependency/lockfile, deployment or scheduler change.
- Files/artifacts: Application scanner-service files, runtime adapters, scanner/protocol/native fixtures/tests, build target/package script; [owning evidence](../evidence/07-scanner-environment-validation.md#trusted-transport-and-actual-durable-pipeline).
- Verification: Full default **795 passed / 11 optional-provider skips** (314 unit/contracts, 89 Node, 235 workerd/D1/R2 emulation, 157 real local isolated PostgreSQL 18.6/S3 emulation). Complete actual signed ClamAV **33 passed / no skips** (15 adapter + 18 durable), 110.76 s; focuses included, not added. Final types/lint/import boundaries/all-target build passed. Prior actual provider/migration/dependency evidence reused unchanged; final ancillary in Module 07.
- Decisions/blockers: Explicit platform streaming bridges preserve types and fixed trust boundaries; digest-construction/error/cancellation cleanup gaps fixed. Miniflare native callback proves local transport to actual Node engine, not deployed Worker-to-native service. Production trusted bridge/resource/egress/admission/signature rotation remains unverified; default scanner selection stays absent.
- Next actions/cautions: Continue independent 07.3h/V4 legacy recovery/retained-key compaction; preserve strict ordinary blob keys and both-profile semantics. No commit/deploy/SPA/Module 09/audit. All runtime/test handles terminal, scanner temp/processes absent, generated measurements restored, protected SECURITY.md unchanged/untracked.


### 2026-10-04 — Module 07 explicit legacy recovery ledger checkpoint

- Scope/checklist IDs: Partial 07.3h/07.V4. Internal application/database mechanism and private test infrastructure; foundation/SAST gates unchanged.
- Progress/change summary: Exact snapshots, explicit retention, trusted ownership/accounting references, atomic absence of every attachment/lifecycle row, immutable retirement keys/decisions and fenced once-only both-counter release. Fixed 20+1 base windows advance over live leases; timeouts retain quota and stop pages. No actual provider recovery/adoption/compaction or public API/scheduler.
- Files/artifacts: Application recovery port/handler, both stores/schema/exports, D1 0023/PostgreSQL 0022 SQL/snapshots/journals and custom guards; shared/forced race/upgrade and unit page fixtures; [owning evidence](../evidence/07-upload-lifecycle-validation.md#explicit-legacy-recovery-ledger-2026-10-04).
- Verification: Focus 19/profile plus 4 unit passed; expanded existing fresh+ledger focus 20/profile passed after schema assertions updated. Composed default **837 passed / 11 optional-provider skips**: 318 unit/contracts, 89 Node/S3 emulation, 254 workerd/D1/R2 emulation, 176 real isolated PostgreSQL 18.6/S3 emulation. Final actual signed ClamAV pipeline **18 passed / no skips**; unchanged actual adapter 15 reused, composed 33 actual. Types/lint/build/history checks passed; 45 prior SQL checksums unchanged. Final ancillary in Module 07.
- Decisions/review: Forced D1 pre-read/CAS link and PostgreSQL project-lock waiting insert prove retirement exclusion. PostgreSQL TRUNCATE now preserves ledger targets. Missing/insufficient accounting rolls back both counters/retirement. Earlier sync-validation/type/fresh-count failures corrected before final acceptance. Recovery manifests/provider callbacks remain synthetic; ordinary key/scan/association policy stays strict.
- Blockers/next actions: Real selected-provider arbitrary-key recovery/manifests/absence and retained-key compaction/quiescence; production scanner/CORS acceptance. Authorized test deployment/browser CORS work remains within the existing 07.3c/V4 plan and named infrastructure; no full checkbox closes.
- Next-session cautions: No commit/SPA/Module 09/suspended audit or shared migration rollout. Preserve prior work/histories, protected SECURITY.md and scanner/updater snapshot separation. Runtime matrix/scanner handles terminal; generated Module 03 measurements byte-restored. Deployment resources/cleanup are tracked in the owning Module 07 record.


### 2026-10-04 — Module 07 authorized disposable browser-origin deployment

- Scope/checklist IDs: Existing 07.3c/V4 test protocol evidence, foundation/gates unchanged. Latest user permits only the named Workers account, `*.test.eihrteam.org`, existing test D1 and Chrome DevTools; no boundary expansion/out-of-plan tests.
- Progress/change summary: Inert disposable plaintext Worker with exact allowed/denied origins, Workers.dev/previews off, named existing D1 bound with zero operations; actual R2 installed Core CORS and Chrome 154 PUT/ETag/three denials. Capabilities are minted through the unchanged local Node/S3 signer, with no public fixture API/secret or SPA.
- Files/artifacts/verification: Ignored private `browser-cors/` config/state/redacted evidence and [owning results](../evidence/07-upload-lifecycle-validation.md#authorized-test-deployment-and-browser-cors-2026-10-04). Dry-run, previously absent Worker, deployment version/startup, verified HTTPS, browser/provider observations, four owned-key HEAD-null cleanup, exact captured CORS restoration, Worker 10007 and zero owned account custom domains verified. Initial TLS/tool restrictions were corrected before acceptance. DNS-record inventory API 403; public DoH no A answers, exhaustive DNS inventory unverified. Default 837/11 and separate composed actual scanner 33 retained unchanged.
- Decisions/blockers/next actions: No production composition/scanner/D1 migration deployment or new tracked test. Full 07.3c product-origin/composition, 07.3h/V4 provider recovery/compaction and 07.3f production isolation remain; no full checkbox closes. Continue within existing boundaries without permission expansion; no commit/SPA/Module 09/audit. Preserve draft/earlier work; final ancillary in Module 07.


### 2026-10-04 — Module 07 fixed S3 historical recovery adapter checkpoint

- Scope/checklist IDs: Existing backend runtime/storage support for partial **07.3h/07.V4**; no new Module 01 acceptance or boundary.
- Progress/change summary: Separate Node/S3 one-decision recovery capability with original closed manifest/destination/snapshot/accounting binding, explicit retention, pre-parser 128 KiB/UTF-8 responses, bounded discovery/abort/delete/absence/deadline and ownership-bound SeaweedFS 4.48 continuation. Known R2 endpoints refuse this generic capability; ordinary BlobStore/current reconciler/runtime composition/public API remain unchanged.
- Files/artifacts: blob-s3 recovery/index, planned native/provider fixtures and existing storage cases; [owning evidence](../evidence/07-upload-lifecycle-validation.md#fixed-s3-legacy-physical-recovery-2026-10-04) and 07 progress/specifications/ADR.
- Verification: Final default composed **869/13** (318 unit/contracts, final 121 Node/S3-emulated, 254 workerd/D1/R2-emulated, 176 isolated PostgreSQL 18.6/S3-emulated); includes 32 synthetic HTTP adapter cases. Separate actual **2 passed**, real isolated SeaweedFS 4.48 recovery and actual R2 refusal/preservation, with owned fixture cleanup verified. Both-profile types/lint/boundaries/all-target build and Drizzle histories pass. Existing scanner/browser/unrelated storage evidence reused at its recorded scope.
- Decisions/blockers: Initial SeaweedFS mixed-prefix ID-only marker rejection diagnosed with pinned source/runtime probes; explicit ownership-bound mode verified. R2 returned undocumented empty versioning response; known endpoint refusal prevents relying on it. Initial fixture type/lint/token-comparison and concurrent lint boundary-fixture failures were corrected; see owning record. No production historical accounting/repair, provider-side scanning/global concurrency or deployment is claimed.
- Next actions/cautions: Continue 07.3h/V4 fixed R2/native recovery and reviewed historical manifests/compaction, then existing 07.3c/07.3f deployment/composition blockers. No commit/deploy/SPA/Module 09/audit; preserve historical SQL, prior work, measurements and protected SECURITY.md. Final docs/preservation ancillary follows in 07.


### 2026-10-04 — Module 07 direct R2 recovery runtime checkpoint

- Scope/checklist IDs: Existing backend storage/runtime support for partial **07.3h/07.V4**, no new Module 01 gate or product boundary.
- Progress/change summary: Async one-decision fixed header-signed R2 capability verifies original manifests/retention, bounded prefix/XML/encoding/absence/deadline and sibling preservation. Actual Node/local workerd proof; ordinary adapters/public composition unchanged. Test observer declares existing aws4fetch 1.0.20 at root, no version/package family change.
- Files/artifacts: blob-r2 recovery/index, planned unit/shared actual fixtures, existing R2 Node suite/loopback Worker, root manifest/lock importer; [owning evidence](../evidence/07-upload-lifecycle-validation.md#direct-r2-approved-record-recovery-2026-10-04), 07 progress/spec/ADR.
- Verification: Final composed **897/14** = 346 unit/contracts, 121 Node/S3 emulation, 254 workerd/D1/R2 emulation, 176 real isolated PostgreSQL/S3 emulation; 28 new local synthetic cases. Actual remote-R2 Node **1 passed** and local workerd **1 explicit proof passed**; 21 target sessions/preserved writable sibling/late sweep, owned cleanup and complete test-prefix zero inventory. Frozen install passes unchanged 641-entry supply-chain policy; types/lint/build/licenses pass.
- Decisions/blockers: First native 503 from remote-proxy non-ASCII HEAD header; exact trace-owned leftover object/session verified/removed. Workerd proof retains Unicode/reserved key with native writes/parts and direct S3 observations/cleanup; native Unicode HEAD through that local gateway remains unverified. Offline install missing unrelated policy metadata, then ordinary frozen install passed without policy changes. No operational historical accounting/repair, internal physical erasure or deployed product is claimed.
- Next actions/cautions: 07.3h/V4 actual-provider/dual-ledger operational recovery/manifests/quiescence/compaction; existing 07.3c/07.3f composition blockers. Never deploy loopback harness. Preserve histories/prior work/measurements/scanner artifacts/SECURITY.md; no commit/SPA/Module 09/audit. Final ancillary recorded in 07.


### 2026-10-04 — Module 07 actual R2 and dual-ledger verification checkpoint

- Scope/checklist IDs: Existing runtime/storage proof for partial **07.3h/07.V4**; no Module 01 gate or service boundary change.
- Progress/change summary: Existing D1/PostgreSQL repository suites add planned opt-in fresh actual-R2/ledger composition. Reserved/used accounting, retirement-before-I/O, wrong-lease retention, once-only release and retained-decision late resweep pass with exact owned cleanup receipts. No runtime application/provider/schema/API change.
- Files/artifacts: Existing shared recovery/provider fixtures and two repository suites; [owning evidence](../evidence/07-upload-lifecycle-validation.md#actual-r2-and-dual-ledger-composition-2026-10-04) and 07 handoff.
- Verification: Four explicit actual-R2 cases, **2 local-workerd/D1** and **2 real isolated PostgreSQL 18.6**, all with Node orchestration; no deployed D1/native-provider composition claim. Fresh 346 unit/contracts, 254 workerd and 176 PostgreSQL regressions; reused unchanged 121 Node checks. Composed default **897/18 optional skips**; extra four default skips are opt-in actual cases. Types/lint/boundaries pass; all fresh resources verified removed and final prefix inventory empty; handles terminal and generated measurements restored. Final ancillary in 07.
- Decisions/blockers/next actions: Operational historical manifests/quiescence/compaction remain separate; continue **07.3h/V4**, then existing **07.3c/07.3f** composition blockers. Actual scanner/provider/browser evidence reused at its exact scope. No commit/deployment/SPA/Module 09/audit; preserve histories/prior work/private artifacts/protected SECURITY.md. Never deploy the loopback blob fixture.

### 2026-10-04 — Module 07 actual Workers upload runtime checkpoint

- Scope/progress: Existing **07.3c/07.V4** deployment proof, no Module 01 gate change/new boundary. Corrected upload root validates static policy globally and requires lazily cached native D1/R2 adapters before serving requests. Initial rejected 10021 uploads have 10007 absence checks; corrected actual deployment is healthy and issues actual R2 capabilities from named remote D1.
- Files/artifacts: Workers upload/index roots, existing configured entry test and ignored `.local/07-deployed-cors/` deployment/regression/cleanup receipts; [evidence](../evidence/07-upload-lifecycle-validation.md#deployed-workers-upload-and-cors-2026-10-04).
- Verification: Existing focus **3/0**, fresh unit/contracts **346/0**, workerd **254/2 optional skips**; unchanged Node **121/14** and real PostgreSQL **176/2** reused, combined **897/18**. Both-profile types/lint/import boundaries/all-target build pass. Actual Chrome upload/CORS/expiry negatives pass separately; three Workers/domain mappings and all eight blob targets absent, captured CORS restored. No loopback harness/scanner deployed; ancillary in 07.
- Decisions/blockers/next: Keep **07.3c** open for corresponding Node/S3 installed-policy/browser proof; **07.3h/V4** historical manifests/quiescence and **07.3f** production bridge/isolation/update remain. Existing boundaries/contracts/holds/draft preserved; no new automated case, commit, SPA, Module 09 or suspended audit. Do not replay disposed secret fixtures.

### 2026-10-05 — Review remediation B8 formal Minimum profile

- Scope/checklist IDs: Approved B8 to 03 tier/crypto/admission, 04 account journeys, 10/13 profile gates, with 01 composition and 02 contracts dependencies.
- Progress/change summary: ADR 0012 supersedes old floor/gate exclusions; canonical tier/new acknowledgement, public peppered PBKDF2 passwords with bounded strength policy, durable login lockout/CAPTCHA, standard Argon2id upgrades and sensitive-route-only activation. Separate Minimum entry omits Wasm. Bilingual disclosures and active plans synchronized.
- Files/artifacts: [B8 evidence](../evidence/2026-10-05-review-remediation.md#b8-formal-cloudflare-minimum-profile-2026-10-05), ADR 0012, roots/config/security/server/contracts/builds and focused fixtures; no database migration.
- Verification: Selected config/audit/provider/activation 36, Minimum journey 7, real PostgreSQL 18.6 account/upgrade journey 1 and final admission 19 passed; typecheck/lint/boundaries/docs pass. Bundle and denylist sizes recorded, initial fixture failures corrected. Local evidence only, no Argon2id performance or independent review claim.
- Decisions/blockers: Authorized Minimum-only offline-strength deviation disclosed; historical v1 audit rows preserved. G1/G2 now require all three profiles and stay closed; additional real-Free 13.G6 open. Actual CPU/startup remains B15.
- Next actions/cautions: Commit B8 then B9 risk-tiered limits. Preserve scoped key/concurrency bounds, one-use permits, stronger-hash refusal, expected credential revision, append-only histories, protected files and remaining holds.
