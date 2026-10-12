# Static frontend foundation

Module 11 P1 implements only 11.1a–g and 11.V1. The user explicitly continued P1 after the P0 report; G1 remains Not passed. Authentication clients, issue workflows, reusable UI primitives and the later browser/accessibility/performance acceptance are separate increments.

## Toolchain and commands

`apps/web` pins React/React DOM 19.3.0, TypeScript 7.0.2, Vite 8.3.4, TanStack Router 1.170.42, Query 5.104.2, Form 1.33.5, Tailwind CSS and its Vite plugin 4.3.3, Base UI 1.9.0 and shadcn 4.21.4. `components.json` selects the CLI's Base UI `base-nova` style; no generated primitive is installed in this increment. Form is exposed for future form ownership; no product form is implemented.

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
| Form | Future form values/validation/submission; dependency/export prepared, no form implemented |
| React | Local presentation; compiler optimization; no duplicate server state |
| Application context | Immutable validated public config and instance-query definition; no credentials or additional global store |

The small entry loads a bounded 16 KiB JSON config with a ten-second abort, `cache: 'no-store'`, `credentials: 'omit'` and rejected redirects. It validates before importing the React app or constructing API/Query clients. Unknown fields, URL credentials/paths/query/fragments and remote HTTP are rejected; loopback HTTP is permitted for development. Missing/invalid config presents a native safe error with retry. No persistent credentials, raw HTML sink, service worker, proxy, SSR or Pages Function exists.

The public API client omits credentials, bounds response size and forwards cancellation. The authoritative `InstanceDocumentSchema` is embedded at build time through a Vite virtual module; the frontend interpreter validates that exact schema without bundling TypeBox/server implementations. Dependent route content remains gated on successful validation. Authentication flags, tier, password policy, search scope, degradation identifiers and limits are displayed from the document, never inferred from config. These flags govern presentation, not server authorization. Identity-specific cache isolation belongs to 11.2.

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
| Future dialogs, forms, richer plugin UI | Not implemented or compatibility-accepted here; formal 11.3/11.V3 ledger and assistive-technology matrix remain pending |

Vite's target transforms supported syntax; it is not a full cross-browser or WCAG conformance claim. Initial bundle sizes are recorded in the P1 evidence; CWV, screen-reader, touch and baseline-browser acceptance remain 11.V3/V4.

## Dependency license review

Installed license files and the frozen inventory were reviewed before adding narrow exceptions in `tooling/licenses.mjs`:

| Exact tooling dependency | License and disposition |
| --- | --- |
| `caniuse-lite@1.0.30001815` | CC-BY-4.0 browser compatibility data used by build tooling. Attribution: caniuse.com contributors, Ben Briggs and caniuse-lite contributors, [upstream](https://github.com/browserslist/caniuse-lite), [license](https://creativecommons.org/licenses/by/4.0/). Installed data is unchanged. Preserve attribution/license and indicate modifications when redistributing the data or a tooling distribution. The data is not embedded in frontend modules. |
| `lightningcss` and platform binaries 1.32.0/1.33.0 | MPL-2.0 CSS build tools. Existing exact 1.33.0 review extended to Tailwind's 1.32.0; no source modifications. These tools are not shipped as browser runtime. Preserve notices and source availability for covered files when distributing tooling binaries; generated application CSS does not contain the tool implementation. |
| `type-fest@4.41.0` | `(MIT OR CC0-1.0)`; choose the already permitted MIT branch. Copyright Sindre Sorhus; preserve the installed MIT notice when redistributing types/tooling. Type-only shadcn tooling does not enter browser output. |

This is an engineering dependency review for the current build graph. It does not approve general runtime use of these licenses, new package/version matches, modification of covered files or a tooling redistribution without its notices. The scanner still rejects unreviewed versions/expressions. Other new stack/compiler dependencies have permitted MIT/ISC/Apache expressions. Bundles contain no Babel, caniuse dataset, Lightning CSS binary, shadcn CLI or backend implementation.

See [P1 evidence](../plan/evidence/11-p1-foundation.md) and the bilingual [hosting guide](../site/guide/deploy-frontend.md).
