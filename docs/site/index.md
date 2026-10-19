# HyperBug documentation

**English** | [简体中文](zh-CN/index.md)

HyperBug is an open-source issue tracker for public feedback and project triage. Start with the task you want to accomplish.

> This is the prepared-but-unpublished candidate manual (2026-10-19). Product workflows and local installation/recovery have evidence; hosted backend G1, MVP G2 and real-Free13.G6 remain open. No production or GitHub Pages publication is claimed.

## Find your guide

| I want to… | Start here |
| --- | --- |
| Understand HyperBug and find a project | [Get started](guide/getting-started.md) |
| Find, report, or discuss an issue | [Issue guide](guide/issues.md) |
| Understand sign-in, access, and privacy | [Accounts and access](guide/accounts.md) |
| Triage feedback or administer a project | [Project management](guide/project-management.md) |
| Choose an installation profile | [Installation overview](guide/deployment.md) |
| Install the Cloudflare backend | [Cloudflare installation](guide/deploy-cloudflare.md) |
| Install the Node/PostgreSQL backend | [Self-hosted installation](guide/deploy-self-hosted.md) |
| Host the independent static frontend | [Frontend hosting](guide/deploy-frontend.md) |
| Upgrade, back up, or recover an installation | [Operations](guide/operations.md) |
| Build an API client | [Public API guide](guide/api.md) |
| Build or manage a plugin | [Extension guide](guide/extensions.md) |
| Diagnose a problem or find reporting guidance | [Troubleshooting and help](guide/troubleshooting.md) |
| Review release changes and compatibility | [Release notes](guide/releases.md) |

## Work on HyperBug today

For the existing backend workspace, use [backend development](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/README.md), [toolchain evidence](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/TOOLCHAIN.md), and [development migrations](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/MIGRATIONS.md). These describe the current foundation; they are not a complete product deployment guide. See also [contributing](https://github.com/EIHRTeam/HyperBug/blob/main/CONTRIBUTING.md).

## Understand the design and roadmap

- [API conventions](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-CONVENTIONS.md), [resource and permission inventory](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-OPERATIONS.md), [data model](https://github.com/EIHRTeam/HyperBug/blob/main/docs/DATA-MODEL.md), and [Markdown policy](https://github.com/EIHRTeam/HyperBug/blob/main/docs/MARKDOWN-POLICY.md) are specifications, not evidence that every described operation is available.
- [Implementation plan](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/README.md), [master progress](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/PROGRESS.md), and [source decisions](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/SOURCES.md) track scope, evidence, and gates.
- MVP includes public feedback, discussion, triage, forms, attachments, search, and extension foundations. Relations, saved views, subscriptions, notifications, bulk/data jobs, and named provider integrations belong to later increments. AI and realtime collaborative editing remain deferred.

## Verification and publication scope

All14guide paths have matching English/Simplified Chinese content. The public API/client and plugin SDK are workspace artifacts, not published registry packages. Installation, operator recovery, known provider limits, private security reporting and release decisions are documented with their actual verification scope. Use [release notes](guide/releases.md) and [operations](guide/operations.md) before deployment.

The VitePress build compiles only this reader tree; engineering plans/evidence remain repository links. Local builds do not publish the site. Preserve matching locale paths and content when updating; product localization is separate. Production/staging decisions and open backend/Minimum gates remain in the [current progress](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/PROGRESS.md).
