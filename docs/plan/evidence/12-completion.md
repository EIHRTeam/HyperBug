# Module 12 completion evidence

Date: 2026-10-19. All 24 canonical checklist items are complete within the user's explicit Module 12 sequencing exception and resumed audit-browsing scope. This is local product acceptance. G1 remains Not passed, Module 10 Blocked and 13.G6 open. No hosted load, deployment, paid resource, later-module implementation, push, merge or PR edit is included.

## Requirement-by-requirement audit

The current production SPA and backend prerequisites were inspected against the checklist. The browser runner exercises actual product controls and accepted APIs; fault injection is identified separately from real service mutations. All three final profile reports pass: [Node 37](12-browser-node.json), [Standard 37](12-browser-standard.json), [Minimum 38](12-browser-minimum.json). The separate upload matrix passes 11/10/10. Read the linked reports' provider and method limits when interpreting a result.

| Item | Implementation and authoritative verification |
| --- | --- |
| 12.1a | Overview/project routes: explicit project-ID selection, taxonomy summaries, bounded lists and state handling. Browser landing/list/cursor/back and stable issue links on all profiles. No directory API is invented. |
| 12.1b | Router/product-state validate query/cursor/newest-created sort. Browser shared bookmark/reload/back plus URL-boundary unit checks; filters use the accepted structured query syntax. |
| 12.1c | Project search debounces, respects composition, cancels through Query/AbortSignal and uses independent query keys. Actual syntax rejection and bounded API searches; state units cover invalid inputs/cancellation/identity partitioning. |
| 12.1d | Product Query keys include origin/epoch/operation/input; deduplication/cancellation/cache tests pass. No unbounded page accumulation or automatic retries; [request counts](12-performance-acceptance.md) show independent bounded reads. |
| 12.2a | New-issue, IssueForm/answer constraints, editor, server preview and safe-tree renderer implement templates and every accepted field, including real released uploads. Actual all-field/preview/create/corpus runs and [upload matrix](12-upload-acceptance.md). |
| 12.2b | Generated IDs, linked errors/help, interacted validation, actionable focus summary, native constraints/controls. Browser validation/ID checks, nine axe surfaces/profile and user manual all-pass; native paste/autofill/IME semantics retain ordinary text editing and no custom textarea Enter submission. |
| 12.2c | Exact-origin direct/multipart transfer, progress/cancel/resume/retry/expiry renewal, finalize/status and isolated media controls. [Actual scanner/storage/browser evidence](12-upload-acceptance.md), including quota/type/expired/dangerous-file checks with explicit provider limits. |
| 12.2d | Immutable form/revision snapshots and memory-only drafts/receipts. Actual competing form update, offline request, bearer revocation, browser-timer expiry and post-commit response-loss retry verify draft recovery/clearing and no duplicate. [Draft policy](../../development/FRONTEND.md). |
| 12.2e | Issue route, mixed timeline, CommentActions and reactions render canonical content, restricted history and moderation states. Actual create/comment/react, edit/history, hide/restore, redaction/deletion and permalink checks. |
| 12.2f | One 20-entry URL-cursor window, explicit timeline heading focus, native scroll anchoring and comment links. Browser checks and [1,000-comment measurements](12-performance-acceptance.md) verify forward/return behavior and bounded DOM. |
| 12.2g | Profiled 1,000 stored comments before optimizing. Final page has 20 rows, 216/224 elements and no observed long tasks in the recorded samples. Ordinary DOM is retained; no virtualization/content-visibility was added. |
| 12.3a | Triage/management call permission-aware APIs for all four assignments, taxonomy metadata and close/reopen/reasons. Actual Triage/Maintainer journeys, role loss and explicit revision reload recovery. |
| 12.3b | Manage/audit/plugins/account routes implement settings, YAML forms/immutable replacements, templates, roles, redacted audit, secret/public plugin configuration and enable/disable, authorization-session controls and separate app sign-out. Actual staff journeys exercise each on all profiles; audit resume is explicit. |
| 12.3c | Native confirmation dialog and authoritative recent assurance; password-only denial, native virtual-authenticator registration/login and actual PKCE step-up, concurrent changes and real permission removal. [ADR 0016](../../decisions/0016-first-party-passkey-step-up-controls.md) and focused HTTP/page/browser/manual checks. |
| 12.3d | Manifest-derived settings expose secret presence only; write-only values clear on success. Actual secret/public writes/enable/disable and explicit trusted-native/CSP copy; [focused source review](12-focused-review.md). |
| 12.3e | Build manifest separates management, audit, triage and plugin chunks. [Hashes/route totals](12-bundles.json), browser lazy loading and source review; no deferred relations/notifications/bulk UI. |
| 12.3f | Persistent Minimum footer/status and session-only detail dismissal, capability explanations and documentation link. Actual Minimum capability document and public/staff browser checks; no false Argon2id claim. |
| 12.V1 | Final 37/37/38 checks cover anonymous, Public User, Triage, Maintainer and Administrator against Node/PostgreSQL and both native local Worker tiers. |
| 12.V2 | Search/share/back, all fields, actual upload recovery, create/comment/react, assignments, close/reopen and timeline permalink assertions pass across the core/upload matrices. |
| 12.V3 | Real competing comment/issue/form changes, actual bearer and project-role revocation, browser-only timer expiry, offline/ambiguous response injection and unchanged receipt retries; malformed searches, quota/type errors, password denial, native cancellation boundary and registered-plugin enable/disable all pass. Backend immutable assurance/time policy is unchanged. |
| 12.V4 | Three current axe-core 4.14.0 nine-surface reports have zero violations. The user's explicit all-pass report covers the requested manual keyboard/screen-reader/touch/zoom/contrast/reduced-motion matrix; [scope and unsupplied AT-version limit](12-browser-acceptance.md#human-accessibility-acceptance--2026-10-19) are recorded. |
| 12.V5 | Actual browser transports/renders 20 accepted corpus bodies; actual API rejects 9 invalid ones. Safe-tree source has no Markdown parser/sanitizer/HTML sink; upload matrix proves inert dangerous downloads, raster-only preview, isolated headers and no app CSP violations. |
| 12.V6 | [Performance report](12-performance-acceptance.md) records hashes/bundles, standard CLS/LCP/INP with soft-navigation limits, long tasks, request counts, source-attributed shift investigation and 1,000-comment DOM behavior. All 24 final lab samples collected sequentially. |
| 12.V7 | Minimum-specific passing check plus shared public/staff journeys cover persistent disclosure, session dismissal/reload, explained unavailable uploads/providers and accurate downgraded capability text. |

## Final verification

On Node 24.21.0, the following current-source checks pass:

- `corepack pnpm typecheck`, `corepack pnpm lint` (including workspace boundaries), `corepack pnpm api:check` (77 paths).
- `corepack pnpm build`, `node tests/fixtures/web-product-bundles.mjs`, `corepack pnpm docs:build`.
- `corepack pnpm exec vitest run --project unit tests/unit/web-product-state.test.ts tests/unit/authorize-passkey-page.test.ts tests/unit/web-auth.test.ts tests/unit/web-foundation.test.ts`: 18/18; `corepack pnpm test:contract`: 2/2.
- `corepack pnpm exec vitest run --project workerd tests/workerd/issue-route.test.ts tests/workerd/oauth-route.test.ts tests/workerd/passkey-route.test.ts`: 6/6.
- `node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs run --project postgres tests/postgres/issue-route.test.ts tests/postgres/oauth-route.test.ts tests/postgres/passkey-route.test.ts`: 6/6 on disposable PostgreSQL 18.6. No optional-provider skip in these selected lanes.
- `corepack pnpm scan:secrets`, scoped `oxfmt --check` over changed implementation/fixture files and `git diff --check` pass. Documentation/checklist/link/hash checks and final docs build are recorded in the closing progress entry.

The root build retains its existing backend bundler advisory about an upload module imported both statically and dynamically; it completes successfully. This does not change the verified frontend lazy graph or assert backend CPU acceptance.

[Focused security/performance review](12-focused-review.md) records the trust boundaries and research; [workflow contract decisions](12-workflow-contracts.md) and ADR 0016 record preview/audit/passkey prerequisites. No unresolved finding remains within this focused implementing-agent review. It is not an independent security audit. English/Chinese issue, account, project-management and frontend-hosting guides are synchronized.

## Handoff and remaining boundaries

No Module 12 checklist work remains. Core/upload/performance/manual runners close their owned browsers, listeners, private clusters, storage and private fixture files; the manual URL is obsolete. No owned workflow service remains live at closure. Standalone measurement assets/screenshots and the ignored scanner snapshot remain local diagnostic artifacts; the snapshot expires under the unchanged 48-hour rule and must be refreshed before a later scan run. System trust/DNS is unchanged by Module 12 fixtures.

The working tree intentionally retains uncommitted implementation and protected user root drafts/handoffs. No commit or external action is claimed. Existing Module 07 production provider/scanner/isolation remainders, Module 10 hosted compatibility/metrics, G1 and 13.G6 remain at their prior states. A local workflow pass must never be relabelled as those acceptance results. Later-module work requires its own applicable scope/gates.
