# Documentation site

The reader documentation uses VitePress's default theme and is published through the GitHub Pages workflow. This site is separate from the future product SPA and does not open G1 or G2.

## Source layout and translation policy

- `docs/site/index.md` and `docs/site/guide/`: English.
- `docs/site/zh-CN/index.md` and `docs/site/zh-CN/guide/`: Simplified Chinese, with the same filenames and coverage.
- `docs/.vitepress/config.ts`: shared configuration, locale navigation, and local search translations.
- `docs/README.md`: bilingual repository entry point.

Update both languages together. Preserve outline status until each documented product workflow has been implemented and verified. Engineering specifications, plans, and progress records remain in English. Links to those repository-only documents use GitHub URLs; they are not compiled into the site or its search index. The initial `docs/guide/` skeleton has moved into the English site source, without maintaining a duplicate copy.

The theme, typography, layout, and language switching use VitePress defaults. No custom theme, components, accessibility overrides, analytics, hosted search service, or backend are required. Local search is generated during the build. The user's scope is default/recommended VitePress configuration; do not add a separate accessibility customization project.

## Local commands

Use the repository's Node 24 and pinned pnpm version, from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

Development and preview print their local URL. The default base is `/HyperBug/`; include this prefix when opening the site. `docs:preview` serves the latest build, so run `docs:build` first. Build artifacts and caches under `docs/.vitepress/` are ignored by Git.

For root or custom-domain hosting, build and preview with the same override:

```sh
DOCS_BASE=/ pnpm docs:build
DOCS_BASE=/ pnpm docs:preview
```

Keep `cleanUrls: false` for GitHub Pages: page links use `.html` and directory indexes, without requiring a rewrite service. VitePress's dead-link check remains enabled. Only `docs/site/` is compiled.

## GitHub Pages

The workflow is [Documentation](../../.github/workflows/docs.yml).

1. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. Configure the `github-pages` environment to allow the default branch if environment protection rules require it.
2. Merge the documentation source, lockfile, and workflow into `main`. Relevant pushes build and deploy automatically; pull requests build without deployment credentials or publication.
3. Alternatively, run **Documentation** with **Run workflow** on `main`. Runs on other branches only build.
4. Check the deployment job and use its reported Pages URL. For this repository's project Pages configuration, the expected URL is `https://eihrteam.github.io/HyperBug/`, with Chinese content under `/zh-CN/`. This expected address is not a claim that a deployment has completed.

Builds install the frozen workspace lockfile and upload only `docs/.vitepress/dist`. Pages and OIDC write permissions are limited to the deployment job; deployments are serialized without cancelling one already running. The workflow derives its project base from the repository name. For an organization-root site or custom domain, also update the workflow's `DOCS_BASE` to `/` and configure the domain in GitHub Pages.

The 2026-09-19 read-only Pages API check returned 404. Pages enablement and hosted deployment therefore remain unverified. This change does not push commits, alter repository settings, or claim a live site. A failed build cannot deploy because the deployment job depends on it. To revert a published documentation change, revert its source/configuration commit and let the workflow rebuild; do not hand-edit generated artifacts.

## Dependency decision and verification

VitePress is pinned to `1.6.4`, the registry's stable release on 2026-09-19; `2.0.0-alpha.20` is the next prerelease and is not adopted. VitePress is development-only, MIT-licensed, and does not change the API build or future product frontend stack.

The initial stable install resolved Vite `5.4.21`. The repository audit then reported high-severity [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff), a development-server file-deny bypass, patched in Vite `6.4.3`. The workspace contains a narrowly scoped `vitepress@1.6.4>vite: 6.4.3` override. Its Vue plugin, `@vitejs/plugin-vue@5.2.4`, declares Vite 6 peer support. This is a documented override beyond VitePress 1.6.4's Vite 5 range, not a claim of upstream VitePress certification. No other consumer's Vite version or install-script policy is changed.

Recheck the override when upgrading VitePress; remove it once the supported dependency range resolves a patched Vite. Required checks are a frozen install, site build, configuration type check, dependency/license audit, and ordinary repository quality checks. Validate both locale trees and generated project-base links. See the module [13 session record](../plan/progress/13-mvp-release-and-operations.md) for outcomes and remaining limitations.

## Documentation lookup record — 2026-09-19

Context7 resolve selected `/vuejs/vitepress` (official source, high reputation). Queries covered locales, local search translations, source directories, static URLs, and Pages deployment. References:

- [Internationalization](https://vitepress.dev/guide/i18n)
- [Site configuration](https://vitepress.dev/reference/site-config)
- [Local search](https://vitepress.dev/reference/default-theme-search)
- [Deployment](https://vitepress.dev/guide/deploy)

Registry checks established the exact stable VitePress, patched Vite, and Vue-plugin peer versions. GitHub release API checks established `configure-pages` v6, `upload-pages-artifact` v5, and `deploy-pages` v5. The existing repository uses checkout/setup-node v7 and Node 24; the new workflow follows it. Context7 returned no answer for VitePress 1.6.4 plus the Vite 6 security override; compatibility is assessed through local build/type checks rather than an invented upstream guarantee.

The `modern-web-guidance` search for bilingual documentation navigation retrieved `accessibility`. Its general guidance informed the initial choice to keep standard theme navigation and locale language metadata. After the user requested default/recommended configuration without additional accessibility emphasis, no custom accessibility implementation or audit was added. No new browser capability or progressive enhancement was introduced; retain the project's Baseline Widely Available policy for future customizations. Browser validation was stopped when the user requested command-based checks only.
