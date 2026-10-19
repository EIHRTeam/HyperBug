# Module 11 P1 foundation evidence

Date: 2026-10-12/13. Branch: `feat/v1`. Scope: **11.1a–g and 11.V1 only**, with the requested React Compiler, oxlint and oxfmt integration. The user explicitly continued P1 after the P0 report. This is a scoped sequencing exception, not G1 acceptance: [P0](10-p0-mcp-trial.md) still stops at unlabelled GET404 CPU16ms against the unchanged10ms limit. Module10 incomplete items, Standard exclusion and13.G6 remain unchanged.

## Requirement audit

| Requirement | Implementation and evidence |
| --- | --- |
| 11.1a | Applicable project/frontend/security/testing guidance read; Context7 resolve/query and modern-web search/retrieve precede implementation. Version/source/compatibility decisions in [frontend engineering guide](../../development/FRONTEND.md). |
| 11.1b | Exact React19/TS7/Vite/TanStack/Tailwind/shadcn/Base UI graph installed with strict peers and one lockfile. shadcn CLI recognizes Vite/Tailwind4/base-nova. No generated primitive or form workflow added. |
| 11.1c | Generic static `apps/web/dist`, Baseline Widely Available syntax target, hashed external JS/CSS and lazy overview/instance routes. Root build supports web/all. No SSR, Functions or required proxy. |
| 11.1d | Bounded/validated fresh public config before dynamic app import/API creation. Generic and Pages A→B replacement changes name and API origin without rebuilding assets. Invalid config browser test shows safe failure with no API/app-chunk request. |
| 11.1e | Router owns shareable section state/history; Query owns validated instance document/cache/cancellation; Form prepared for future forms; React owns local presentation. Immutable public context only, no credentials/global store. |
| 11.1f | Generated host-neutral CSP/cache/security policy plus Pages adapters; exact public origins and empty reviewed build-time plugin list. Actual Pages headers confirm detached cache overrides; source/unit checks reject unsafe origins/remote-code config. |
| 11.1g | Authoritative public capability schema embedded at build time and validated before dependent route content. Tier/degradation/search/password/auth/limit facts come from API. Minimum invalid/unavailable/closed schema cases covered by focused tests; no auth workflow request is implemented. |
| 11.V1 | Same compiled assets on loopback generic server and actual Pages preview; direct `/instance?section=limits`, config A→B on both, hash equality and actual cache/CSP checks. Cleanup verified below. |

## Focused verification

Node24.21.0, pnpm11.26.0, Vite8.3.4, React Compiler1.0.0, oxlint1.83.0, oxfmt0.68.0. Commands use `corepack pnpm --config.enable-global-virtual-store=false` on this workstation.

- Root `typecheck` and `lint` pass; web `lint` and `format:check` pass. Scoped formatting of changed root tooling/config/test files passes. Root boundary checks include TSX.
- `exec vitest run --project unit tests/unit/web-foundation.test.ts tests/unit/oxlint-config.test.ts tests/unit/boundaries.test.ts`: **10 passed**, no skips (five new trust-boundary tests plus existing lint/import-boundary regression checks).
- Web build passes; compiler memo-cache output appears in shell and both route chunks. Bundles contain no backend implementations, TypeBox runtime, build compiler/CLI or compatibility dataset. No browser persistent-credential or unsafe-HTML path exists.
- `CI=true ... install --frozen-lockfile --offline`: pass,20 workspace projects, graph already up to date. No lifecycle allowance expansion. Existing external versions are preserved; narrow dependency/metadata issues and exact tooling license review are recorded in the frontend guide.
- Expanded actual license scan passes **15 expressions** after exact package/version reviews; generic `scan:licenses` wrapper cannot inherit this host's command-local layout flag. Reading external pnpm metadata needs sandbox read permission; a sandbox-only missing-index error is not a failed license finding.
- `node tooling/secrets.mjs`: pass. No new test skip/only annotation. Whitespace/docs checks recorded at final handoff.

Full backend suites, deployment acceptance, authentication/storage leakage matrix, formal accessibility/browser baseline matrix and CWV were not rerun or claimed: this increment does not change backend behavior and those frontend acceptance IDs are outside P1.

## Same-build hosting observations

Generic server: `http://127.0.0.1:4173`. Real API: local production `dist/node/index.mjs` at4408, public read-only instance endpoint, no database or key bindings. Exact local CORS includes the generic/owned preview origins. It is a Standard capability document, not a paid Standard deployment measurement. An initial Pages CORS denial correctly gated content; only the local test origin allowlist was corrected, with no backend source/policy change.

Config A uses `HyperBug Local Preview` / `http://127.0.0.1:4408`; config B uses `HyperBug Runtime Replacement` / `http://localhost:4408`. Both hosts use these replacement configs and regenerate CSP while retaining the compiled artifacts. Pages B has no console errors/warnings. Config response completes before API request starts (observed Pages B:907.7ms vs918.4ms from navigation). Browser local/session storage remain empty. Generic native Link navigation and back/forward restore `section=limits`. Invalid config requests only entry/CSS/config/favicon, shows the safe startup error and creates no API access.

Actual headers: HTML `no-cache`, config `no-store`, assets `public, max-age=31536000, immutable`. Pages B connect-src contains the new exact localhost API/auth origin. Generic/Pages browser-fetched SHA-256 of entry/CSS/app/instance match the captured build hashes:

| Asset | Bytes (gzip where recorded) | SHA-256 |
| --- | --- | --- |
| `index-C_7CCv1a.js` | 4.85kB (2.14kB) | `ea2dffef329f7db7c29cc12cf431d4ca6a1b160ccf6ac5289c08dc1eaaeaefe0` |
| `app-DpDiC5eH.js` | 356.93kB (109.49kB) | `ee265b2cdeded79d9dab9976190571ccaec0162e9b4134c514991e3ca1e8e3c7` |
| `overview-Dq-t7g9O.js` | 2.56kB | `fbd3775c9c190ca08e01a183f78f711cc071fbcb62776434e88b5390a80a0dbd` |
| `instance-DdC8pbxQ.js` | 3.90kB | `13db60fab33da82995e2d7e00adf48052654d95495299018c3a4feba829dd54b` |
| `index-CRC41jO4.css` | 7.84kB | `36a6b32307469c67539fef25b831e14caec292dab3e8202c274bdc34c8edd242` |

These are build sizes, not CWV or an initial-load SLA. The config-first entry deliberately delays loading the main app until validation.

## Temporary test-infrastructure inventory and cleanup

Authorized temporary Pages test project: `hyperbug-11-9f880c7e4720`, account`aa51b5f3a1a926d4c97fbd0bd7e48646`, preview branch`foundation`, unused production branch`unused-production`. Deployments`06c264dc-b4e9-4023-8056-5d075cc2fdde` and`f7988915-f3a8-41c6-8560-30e27c7408c8` are both confirmed **preview** through cloudflare-api MCP. No production/staging deployment or Functions.

Original project names: `endfield-blueprint-editor`, `preservator`, `auth`, `lynchpin`, `main`, `esperanta`. An independent finite guardian was started but its authentication refresh/cleanup failed at2026-10-12T15:08:18Z; it exited. A controlled stop file was written, then MCP cleanup was attempted. Automatic approval review initially rejected deletion because exact-project authorization could not be established. On2026-10-13 the user explicitly authorized deleting this project and its two previews; the cloudflare-api MCP deletion succeeds with200. Final checks at06:45 JST return provider8000007 (Project not found) for the project, deployment list and both exact deployment IDs. Account inventory has0 owned projects and the same six original names/subdomains. [Cleanup receipt](11-p1-cleanup.json) verifies the original inventory comparison and zero owned resources. **P1 cleanup is complete.** No rejection was bypassed or another trial created.

Both owned local listener processes23896/25431 were identified by exact command and stopped, with no remaining listeners on4173/4408. Owned Chrome pages2/3 closed; pre-existing about:blank retained. No P1 D1/R2/Queue/Workflow/custom-domain resource, data mutation or generated application secret was created.

Private ignored receipts and screenshot: `.local/module11-p1/`; these are local handoff aids, not published diagnostics. Reader guides are synchronized in [English](../../site/guide/deploy-frontend.md) and [Simplified Chinese](../../site/zh-CN/guide/deploy-frontend.md). Protected root drafts/handoffs remain unstaged. No push, PR edit or production release is authorized.

Final documentation checks: VitePress1.6.4 build passes,448 scoped relative links/checklist/G1 invariants pass, whitespace passes. Existing Markdown formatter exclusion is preserved. All old lockfile package keys remain; only root importer gains the public API client link and apps/web is added. No backend implementation source changes.

## Final completion audit — 2026-10-13

11.1a–g and11.V1 are complete at their specified scope. Source/toolchain/config/state/CSP/capability invariants and both-host evidence remain the committed c8174d9 implementation. Local processes/tabs are closed; the authorized cloudflare-api deletion and preserved original inventory close the only remaining P1 obligation. Protected root drafts remain unstaged. No source change or new application test run is needed for this cleanup/documentation-only closure. G1 remains Not passed; Module11 remains In progress because11.2/11.3/11.V2–V5 are not implemented or authorized. No later-module, paid, staging/production, push or PR action occurred.
