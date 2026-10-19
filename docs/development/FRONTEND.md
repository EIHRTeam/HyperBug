# Static frontend foundation

Module 11 implements the static foundation, browser authentication boundary and accessible primitives. The user extended the P1 sequencing exception to all Module 11 on 2026-10-13; G1 remains Not passed and Module 10 remains Blocked. Module 12 product workflows are complete at their recorded local/manual scopes under the user's 2026-10-18 sequencing exception; see the [completion evidence](../plan/evidence/12-completion.md). Verification status is recorded in the owning checklist and evidence.

## Toolchain and commands

`apps/web` pins React/React DOM 19.3.0, TypeScript 7.0.2, Vite 8.3.4, TanStack Router 1.170.42, Query 5.104.2, Form 1.33.5, Tailwind CSS and its Vite plugin 4.3.3, and Base UI 1.9.0. `components.json` retains the shadcn Base UI `base-nova` style; primitives are authored as source without a generator. Form owns product editors, Issue Forms and command forms as well as the separate foundation acceptance fixture.

The unused shadcn 4.21.4 generator CLI was removed from the locked development graph on 2026-10-13: its fast-glob/micromatch chain brings in braces 3.0.3, affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), with no patched version listed at lookup time. No source/build script imports the CLI, so the existing shell, Base UI dependencies and component configuration remain usable. Before a future component-generation increment, review a CLI graph that passes the unchanged full dependency audit; do not restore the vulnerable version or bypass the audit.

React Compiler 1.0.0 runs through `reactCompilerPreset({ target: '19' })` in `vite.config.ts`, using `@rolldown/plugin-babel` 0.2.4 and Babel 7.29.7. The stable Babel integration is selected; the experimental Rust implementation is not required. Production shell and both route chunks contain compiler memo-cache output. Compilation is an optimization and cannot replace hook rules or behavioral checks.

From the repository root, using the pinned Node 24/pnpm 11 toolchain:

```sh
corepack pnpm --filter @hyperbug/web dev
corepack pnpm --filter @hyperbug/web typecheck
corepack pnpm --filter @hyperbug/web lint
corepack pnpm --filter @hyperbug/web format
corepack pnpm --filter @hyperbug/web format:check
corepack pnpm --filter @hyperbug/web build
```

Frontend scripts use the workspace's oxlint 1.83.0 and oxfmt 0.68.0. The React and JSX accessibility plugins, rules-of-hooks and exhaustive-deps apply to frontend TS/TSX. Automatic JSX needs no React namespace import. Formatting covers source, scripts and configuration, excluding generated output. Root typecheck, lint, formatting and all-target build also cover the frontend; `node tooling/build.ts --target=web` is available. The boundary scanner now includes TSX and permits same-owner imports while rejecting backend implementation imports. Browser dependencies may use the public client/contracts only.

On this workstation pnpm requires `--config.enable-global-virtual-store=false` to use the existing conventional workspace layout; it is a command-local setting, not a repository policy change. Reading the external store's license metadata requires sandbox read permission. The nested `scan:licenses` wrapper does not inherit this flag; the actual equivalent scan is `corepack pnpm --config.enable-global-virtual-store=false licenses list --json | node tooling/licenses.mjs`. The AWS SDK package-index repair restored metadata for its existing exact version without changing the graph.

Strict peers, frozen installation and existing lifecycle controls remain enforced. Exact release-age exceptions for Query/core 5.104.2 and the pre-1.0 Babel bridge are recorded in `pnpm-workspace.yaml`; they do not exempt future versions. Vitest retains its prior Vite 8.3.0 resolution through a scoped override, while the frontend uses 8.3.4.

## State and trust boundaries

| Owner | Foundation responsibility |
| --- | --- |
| Router | Paths and shareable `section=capabilities|limits` state; lazy overview and instance routes; browser history |
| Query | Public instance document, keyed by API origin; 60-second stale time and five-minute garbage collection; cancellation; no automatic retry/refocus/reconnect request |
| Form | Issue/comment editors, Issue Form values and administrative commands; separate foundation acceptance fixture |
| React | Local presentation; compiler optimization; no duplicate server state |
| Application context | Validated config, public query definition and the minimal BrowserAuth controller; immutable credential-free snapshots, private memory-only token |

The small entry loads a bounded 16 KiB JSON config with a ten-second abort, `cache: 'no-store'`, `credentials: 'omit'` and rejected redirects. It validates before importing the React app or constructing API/Query clients. Unknown fields, URL credentials/paths/query/fragments and remote HTTP are rejected; loopback HTTP is permitted for development. Missing/invalid config presents a native safe error with retry. No persistent credentials, raw HTML sink, service worker, proxy, SSR or Pages Function exists.

The public API client omits credentials, bounds response size and forwards cancellation. The authoritative `InstanceDocumentSchema` is embedded at build time through a Vite virtual module; the frontend interpreter validates that exact schema without bundling TypeBox/server implementations. Dependent route content remains gated on successful validation. Authentication flags, tier, password policy, search scope, degradation identifiers and limits are displayed from the document, never inferred from config. These flags govern presentation, not server authorization. Identity-specific cache/epoch isolation is implemented by 11.2.

`prepare-deployment.ts` generates host-neutral `hosting.json` plus Pages adapters from validated runtime config and reviewed build-time plugin origins. The current plugin list is empty. Exact API/auth/media origins are permitted; no unsafe-inline/eval or arbitrary runtime plugin loading is introduced. CSP output is bounded to Pages' 2,000-character line limit. Changing origins requires regenerating headers as well as replacing config. Pages detachment syntax `! Cache-Control` prevents overlapping defaults from being merged into config/asset overrides.

## Research and compatibility ledger

Lookup: 2026-10-12/13. Context7 resolve then query covered React, React Compiler, Vite, Router/Query/Form, Tailwind, shadcn, Base UI, TypeScript, pnpm, Pages and Oxc. The initial compiler resolution returned unrelated libraries; refined `/websites/react_dev` results plus the installed plugin README established the stable bridge. `/websites/oxc_rs_guide_usage` supplied scoped React/hook/accessibility configuration. Installed exports, peer constraints, registry versions and actual builds resolved remaining integration questions.

Relevant primary references: [React Compiler installation](https://react.dev/learn/react-compiler/installation), [Vite React plugin](https://github.com/vitejs/vite-plugin-react), [Vite build](https://vite.dev/guide/build), [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview), [Query](https://tanstack.com/query/latest/docs/framework/react/overview), [Form](https://tanstack.com/form/latest/docs/framework/react/overview), [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite), [shadcn Base UI](https://ui.shadcn.com/docs), [Base UI](https://base-ui.com/), [Oxc usage](https://oxc.rs/docs/guide/usage/oxlint.html), [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/) and [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/).

Modern-web-guidance search/retrieve ran before web implementation, with guide IDs `security`, `performance` and `accessibility`. Retrieved guidance was applied with the static-app policy: exact-source CSP, external modules/styles, native semantic controls, lazy routes and bounded requests. SSR/nonces, inline-handler examples, blanket Trusted Types/isolation and cookie-backed business API recommendations do not apply to this scope.

| Feature | Compatibility decision and fallback |
| --- | --- |
| Native links/landmarks/buttons, history, modules, fetch/AbortController, CSS custom properties/grid/flex/clamp | Established platform features within the selected Baseline Widely Available target; ordinary native controls and plain CSS define the foundation |
| Focus-visible and reduced-motion query | Established support; explicit focus styles and no essential animation; no workflow depends on motion |
| Tailwind-generated `@property`/newer CSS | Optional generated enhancements only; shell layout/colors use ordinary declarations, with no essential utility requiring these features |
| Compiler | Build-time tool; generated React 19 runtime memoization tested; no additional browser API requirement |
| Native dialogs, fields, source-composed plugin slots | Implemented and verified at the Module 11 scopes below; product forms and installed plugins remain later work |

Vite's target transforms supported syntax; it is not a full cross-browser or WCAG conformance claim. Initial bundle sizes are recorded in the P1 evidence; Current CWV, manual VoiceOver/Safari and emulated-touch evidence is recorded in Module 11 B3; no field performance or full-device matrix is claimed.

## Dependency license review

Installed license files and the frozen inventory were reviewed before adding narrow exceptions in `tooling/licenses.mjs`:

| Exact tooling dependency | License and disposition |
| --- | --- |
| `caniuse-lite@1.0.30001815` | CC-BY-4.0 browser compatibility data used by build tooling. Attribution: caniuse.com contributors, Ben Briggs and caniuse-lite contributors, [upstream](https://github.com/browserslist/caniuse-lite), [license](https://creativecommons.org/licenses/by/4.0/). Installed data is unchanged. Preserve attribution/license and indicate modifications when redistributing the data or a tooling distribution. The data is not embedded in frontend modules. |
| `lightningcss` and platform binaries 1.32.0/1.33.0 | MPL-2.0 CSS build tools. Existing exact 1.33.0 review extended to Tailwind's 1.32.0; no source modifications. These tools are not shipped as browser runtime. Preserve notices and source availability for covered files when distributing tooling binaries; generated application CSS does not contain the tool implementation. |
| `type-fest@4.41.0` | `(MIT OR CC0-1.0)`; choose the already permitted MIT branch. Copyright Sindre Sorhus; preserve the installed MIT notice when redistributing types/tooling. Type-only shadcn tooling does not enter browser output. |

This is an engineering dependency review for the current build graph. It does not approve general runtime use of these licenses, new package/version matches, modification of covered files or a tooling redistribution without its notices. The scanner still rejects unreviewed versions/expressions. Other new stack/compiler dependencies have permitted MIT/ISC/Apache expressions. Bundles contain no Babel, caniuse dataset, Lightning CSS binary, shadcn CLI or backend implementation.

See [P1 evidence](../plan/evidence/11-p1-foundation.md) and the bilingual [hosting guide](../site/guide/deploy-frontend.md).


## Browser authentication boundary (Module 11 B1)

The user authorized the rest of Module 11 on 2026-10-13 as a sequencing exception. G1 remains Not passed and Module 10 Blocked; the separate 2026-10-18 user direction now authorizes Module 12. Register the public client `hyperbug-web`, exact frontend `/oauth/callback` URI and `public-api` scope on the authorization service. There is no client secret.

A sign-in uses fresh 256-bit state/verifier and SHA-256 PKCE at the top level. The per-tab `hyperbug.pkce.v1` sessionStorage entry contains only state, verifier, creation time, validated return route and bound origins. Its acceptance lifetime is five minutes; one callback consumes it before token exchange, including failures. Public-page startup discards abandoned state. Callback query/fragment data is removed before fetching configuration; configuration failure clears pending state. Only `/`, `/account` and canonical `/instance?section=capabilities|limits` return targets are accepted. Callback exchange occurs before React mounts, avoiding StrictMode replay.

The token stays in a private memory field outside React and Query. Exchange and business calls use the public client with omitted credentials, no-store, no referrer and rejected redirects. Reload loses the token and offers an explicit top-level flow; no automatic loop, refresh token or iframe is used. Expiry/401, 403/recent-auth failure, login changes, logout and restored bfcache pages cancel pending requests, clear Query/mutation caches and advance the auth epoch. Route content is keyed by this epoch so future form drafts cannot survive a principal/permission boundary. Only the validated public instance cache is retained. Every protected request checks the epoch before releasing its result.

Sign-out is the accepted API-only logout: discard local state immediately, revoke the captured token through `/auth/token/revoke`, and broadcast a token-free sign-out event to other same-origin tabs when BroadcastChannel exists. Server failure is disclosed; local credentials still disappear. The authorization service's first-party cookie session remains separate. No cross-origin cookie logout request or auth-origin HTML modification is introduced.

Context7 resolve/query on 2026-10-13: `/tanstack/query` (cancellation, dependent query keys, QueryClient/mutation cache clear), `/tanstack/form` (interaction/submit validation and field errors), `/microsoft/playwright` (role locators and CDP sessions). Sources: [Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Form validation](https://tanstack.com/form/latest/docs/framework/react/guides/validation), [Playwright CDP](https://playwright.dev/docs/api/class-cdpsession). Context7 did not cover macOS certificate trust or Network.setCookieControls; the existing fixture and actual local Chrome experiment supply that evidence. No package is added.


## Accessible primitives and compatibility (Module 11 B2)

`components/ui.tsx` supplies associated labels/hints, fields with one interaction-gated visual/ARIA error state, a focused error summary with links, loading/empty/error/permission messages and a native confirmation dialog. TanStack Form owns values/validation; errors become visible after blur or submit and clear on correction. Required/minimum/maximum constraints remain native attributes. With `noValidate`, Form drives the shared error/ARIA boolean rather than combining native pseudo-class state with a second validator. Error summaries receive focus after failed submission; field errors and summaries are not additional live regions. Plain native controls supply keyboard/IME behavior.

Dialogs open with `showModal()`, deliberately focus Cancel, retain native Escape/inertness and restore the trigger on close. Explicit Cancel remains available on touch devices. No light-dismiss, mobile back gesture or `closedby` dependency is needed. Route titles and main focus update after Router `onRendered`; identity-boundary focus returns to main. CSS uses readable wrapping, input boundaries, visible outline focus, responsive wrapping, ordinary layout and no essential motion.

Only source-imported descriptors in `plugins.ts` can populate the `instance` extension slot. Unique ids, slot/component shape and exact public origins are checked; descriptors and origin arrays are frozen. Hosting CSP derives from those same declarations. Runtime JSON still rejects extra code/plugin fields. No native plugin is installed and no remote script is loaded by the slot. Provider script permissions remain reviewed build-time declarations under the existing policy.

Modern-web search/retrieve, 2026-10-13: `accessibility`, `validate-input-after-interaction`, `accessible-error-announcement`, `required-field-feedback`, `light-dismiss-a-dialog`, `platform-controls-dismiss-dialog`. The installed skill-version warns that a newer skill file exists; current guide content was fetched successfully. No skill installation is part of this task.

| Feature | Current compatibility and chosen behavior |
| --- | --- |
| Labels/required controls, focus-visible, reduced-motion, grid/flex/wrapping | Baseline Widely Available; semantic native controls and outline focus; no motion dependency |
| `:user-valid` / `:user-invalid` | Guides report Widely Available since 2023-11-02; Form's interacted/error state drives both visuals and ARIA instead of relying on native selector timing for custom validation. No selector/polyfill required |
| Native dialog / showModal / Escape | Widely Available baseline; native focus/inertness with explicit initial/restored focus and Cancel |
| Dialog `closedby` / mobile back / light-dismiss | Guides report Limited Availability (no Safari); omitted. Escape and explicit Cancel remain complete dismissal mechanisms |
| BroadcastChannel | Optional detected cross-tab sign-out enhancement; per-tab memory expiry/revocation still work without it |
| Secure-context Web Crypto, URL/history/sessionStorage | Existing platform baseline; storage failure prevents sign-in safely while public browsing remains usable; access tokens never persist |
| PerformanceObserver event timing | Measurement-only browser tooling, never a workflow dependency; unavailable measurements are reported rather than polyfilled |

Additional Context7 resolve/query: `/tanstack/router` (`onRendered` focus after committed DOM; useLocation can describe pending navigation), `/websites/react_dev_reference` (immutable cached useSyncExternalStore snapshots, effect timing/StrictMode), `/vitejs/vite` (configFile:false and explicit separate build input). References: [Router events](https://tanstack.com/router/latest/docs/framework/react/guide/router-events), [React external store](https://react.dev/reference/react/useSyncExternalStore), [Vite build API](https://vite.dev/guide/api-javascript#build). Actual pinned exports/typechecks/builds supply version-specific integration proof.

`node apps/web/scripts/build-ui-fixture.ts` builds `fixtures/ui.html` separately into `/tmp/hyperbug-module11-ui`; it does not alter production build input. The fixture uses the same primitives/Form/auth boundary for browser and assistive-technology checks without implementing Module 12 product forms or publishing test hooks. The local runner may serve this artifact only on its disposable test hosts.


## Module 11 verification scope (2026-10-13)

[Final evidence](../plan/evidence/11-completion.md) pairs each checklist item with actual observations. Cross-site production-app login/reload/recovery/API-only logout uses real local Node/PostgreSQL and trusted HTTPS Chrome with a blocked third-party-cookie canary. The separate source-built UI fixture proves real Staff→User changes, revoked-token denial during edits and expiry clearing of drafts/caches; its clock acceleration affects only the actual browser timer. Source tests also cover 403 and a cancelled late callback exchange, including cross-tab logout and unavailable storage. No credential enters snapshots or persistence.

The user reports all pass for manual Safari27.0/VoiceOver, keyboard, field/dialog, 200% zoom, narrow layout, touch emulation, reduced motion and navigation/history checks. Safari version comes from its local application bundle; speech was not recorded. Automated Chrome155 checks and stylesheet contrast calculations supplement this report. No physical phone, Firefox runtime or exhaustive assistive-technology matrix is claimed; essential features use the compatibility ledger's Widely Available platform mechanisms. No further native computer-use tests occurred after the user's direction.

A real existing Minimum Worker fixture runs locally in Miniflare/workerd with private D1 migrations, key registry and acknowledged audited tier activation. Its actual capability document drives title-only search, PBKDF2 disclosure, background limits and unavailable passkeys. Additional network fault injection tests unavailable auth and malformed capability documents; those are client failure-state tests, not provider acceptance. No hosted traffic or 13.G6 claim.

Context7 Miniflare resolution initially returned no library. Refined Cloudflare Workers resolution selected `/cloudflare/workers-sdk`; query returned the official [Miniflare README](https://github.com/cloudflare/workers-sdk/tree/main/packages/miniflare), ready URL, D1 access and dispose methods. The pinned5.20260926.1-alpha converter/module options come from existing repository fixtures and actual runtime proof. No dependency added.

Performance uses automated CDP timeline tracing plus PerformanceObserver rather than native computer-use testing, following the user override. Numbers are one local cold sample with cache disabled, no throttling and a 250ms observer settling window; lab interaction candidates are not field INP percentiles or an SLO. Actual assets, raw/gzip sizes, lazy route loading, largest chunk and zero CSP violations are recorded in [baseline](../plan/evidence/11-performance-baseline.json). A test-only Query cache indicator required a proper subscription because a direct mutable-cache read was memoized by the React Compiler; the production app already uses Query subscriptions.


## Product workflows (Module 12, complete at local scope)

Project selection uses explicit UUIDs because the accepted API has no public directory. Router validates bounded search/cursor/sort state. Query product keys include API origin, auth epoch, operation and input, with 15-second stale/60-second garbage-collection windows, explicit cancellation and no automatic refocus/reconnect retries. Timeline cursors replace one 20-entry DOM window. Identity/path keys discard private drafts across account or project changes. Main focus follows pathname changes; debounced search does not steal input focus.

Issue/comment editors and Issue Forms hold drafts and idempotency receipts only in memory. Pending or ambiguous submissions lock their values; unchanged retries reuse receipts. No background save or private draft persistence exists. Edits capture the original revision; explicit discard/reload remounts with current data. React useId links every mounted control, hint and summary without collisions. Native input/select/checkbox/fieldset behavior retains paste, autofill and IME; textarea Enter inserts a newline.

Preview is an explicit call to the canonical server pipeline, sharing its existing comment content-work rate budget. Issue Form previews validate the current immutable form version. The SPA renders only the transported versioned safe tree; it imports no Markdown parser/sanitizer and uses no user-content HTML sink. External image references require an explicit isolated navigation. Optional attachment previews accept only server-released raster types up to 8 MiB; downloads remain bounded at 32 MiB, bearer-authorized on the configured isolated media origin and abort across identity changes.

`uploadOrigins` is optional public runtime configuration: at most 16 exact HTTPS origins (loopback HTTP for local work). Deployment headers must be regenerated when it changes. CSP adds those origins to connect-src; the transfer helper accepts only capability URLs on this list with permitted PUT headers, no user-info/fragment and a live expiry. The UI also excludes SPA/API/auth origins. No bearer or ambient cross-origin cookie is sent to storage. Direct and bounded sequential multipart transfers support progress/cancel/retry; finalization does not itself assert scanning/release. Actual local upload/media browser acceptance passes Node 11, Standard 10 and Minimum 10 checks; see [provider/scanner distinctions](../plan/evidence/12-upload-acceptance.md). Returned direct/multipart capabilities renew once on expiry; ordinary canonical attachment links use the same authorized preview/download controls as attachment images.

Project management, triage, audit and plugins load in separate chunks. Permissions remain authoritative on every API call; a 401/403/recent-auth failure clears identity-specific state. Sensitive administration still requires recent assurance 2. Backend-owned first-party passkey controls under ADR 0016 perform native registration/login and existing PKCE consent; the SPA never handles passkey secrets or cookie sessions. Plugin reads show secret presence only; write-only fields clear after success. Trust/CSP declarations describe reviewed requirements and never enable remote runtime code.

The Minimum footer always retains its status entry. Details dismiss only for the current session/instance and never change capability enforcement or claim Argon2id protection. Browser reports and final acceptance are in Module 12's progress record; local Chrome/workerd/PostgreSQL evidence does not pass G1 or Free-plan acceptance.

Research, 2026-10-18: Context7 resolve/query covered TanStack Query/Router/Form, Elysia, Playwright, Cloudflare Workers/Miniflare, SimpleWebAuthn and React useId (`/reactjs/react.dev`; [related accessible IDs](https://react.dev/reference/react/useId)). Modern-web action search/retrieve covered `forms`, `required-field-feedback`, `accessible-error-announcement`, `ime-safe-enter-submit`. The installed skill-version warns of a newer SKILL.md; current guide content was retrieved. Native forms/fieldset/legend/ARIA-describedby and coordinated interaction validation stay within Baseline Widely Available. No custom textarea Enter handler requires isComposing or its Safari fallback. No SSR, ambient business cookies, inline scripts or second content sanitizer is added from generic examples. Source and actual pinned runtime evidence resolve integration details; manual product accessibility and final performance/security acceptance are complete at the scopes in the final Module 12 evidence map.

Research and verification, 2026-10-19: Context7 `/tanstack/query` confirms direct fetch/refetch results are distinct from observer render timing. Explicit conflict recovery applies a returned snapshot atomically with the form generation; immutable edit callbacks still preserve drafts across background changes. Modern-web action search/retrieve refreshed `validate-input-after-interaction` and `accessible-error-announcement`: native constraints, linked help/errors and one coordinated Form/ARIA state remain within Baseline Widely Available; no custom control or newer capability is required. Axe-core 4.14.0 reports zero violations across nine surfaces on each local profile after safe-tree task-checkbox naming was fixed; native contrast incompletes and human WCAG observations stay separate.


Final Module 12 verification, 2026-10-19: the [completion audit](../plan/evidence/12-completion.md) maps all 24 outcomes. Current production browser checks pass 37 Node, 37 Standard and 38 Minimum cases, upload checks 11/10/10 and axe checks nine surfaces/profile with zero violations. The user reports the requested manual matrix all pass; exact assistive-technology version was not supplied. [Isolated performance evidence](../plan/evidence/12-performance-acceptance.md) records standard session-window CLS/LCP/INP, feature-detected soft navigation, bounded timeline DOM, requests and source-attributed startup-shift fixes. [Focused review](../plan/evidence/12-focused-review.md) records Context7 `/microsoft/playwright`, `/googlechrome/web-vitals`, `/tanstack/router` and `/tanstack/query` plus modern-web guides `identify-inp-causes` and `interaction-paint-timing`; instrumentation-only Event Timing is Newly Available and soft-navigation/interaction-paint/long-animation-frame details Limited Availability. Product functionality retains Widely Available native controls/CSS and no dependency on those measurement APIs. Local fixtures are stopped. G1, Module 10 and 13.G6 remain unchanged.
