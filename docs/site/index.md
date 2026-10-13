# HyperBug documentation

**English** | [简体中文](zh-CN/index.md)

HyperBug is an open-source issue tracker for public feedback and project triage. Start with the task you want to accomplish.

> These reader guides are an initial skeleton, not a released product manual. The repository currently contains backend and persistence foundations; the product workflows, full API and static web application are still planned. See [current implementation status](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/PROGRESS.md). There is no production installation quickstart verified by this documentation.

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
| Review release changes and compatibility | [Release notes outline](guide/releases.md) |

## Work on HyperBug today

For the existing backend workspace, use [backend development](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/README.md), [toolchain evidence](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/TOOLCHAIN.md), and [development migrations](https://github.com/EIHRTeam/HyperBug/blob/main/docs/development/MIGRATIONS.md). These describe the current foundation; they are not a complete product deployment guide. See also [contributing](https://github.com/EIHRTeam/HyperBug/blob/main/CONTRIBUTING.md).

## Understand the design and roadmap

- [API conventions](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-CONVENTIONS.md), [resource and permission inventory](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-OPERATIONS.md), [data model](https://github.com/EIHRTeam/HyperBug/blob/main/docs/DATA-MODEL.md), and [Markdown policy](https://github.com/EIHRTeam/HyperBug/blob/main/docs/MARKDOWN-POLICY.md) are specifications, not evidence that every described operation is available.
- [Implementation plan](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/README.md), [master progress](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/PROGRESS.md), and [source decisions](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/SOURCES.md) track scope, evidence, and gates.
- MVP includes public feedback, discussion, triage, forms, attachments, search, and extension foundations. Relations, saved views, subscriptions, notifications, bulk/data jobs, and named provider integrations belong to later increments. AI and realtime collaborative editing remain deferred.

## Complete these guides

All pages under `guide/` currently have **Outline only** status. Their headings define the intended reading flow; “To write” text specifies the remaining content. Each page records its audience, goal, sources, and completion evidence.

Replace an outline with task steps only after the behavior is implemented and verified. A completed guide should contain prerequisites and permissions, numbered actions with expected results, recovery for likely failures, related reading, and the release/environment against which it was checked. Use actual interface labels and safe examples. Add screenshots only from the implemented product.

Keep implementation and security policy in their canonical specifications; explain their user-visible effects here. Verify commands, API examples, configuration fields, support contacts, provider claims, and links before publication. Do not fill gaps with hypothetical commands or screenshots. Reader documentation is maintained in English and Simplified Chinese with matching page paths and scope. Update both versions together; engineering specifications, plans, and session records remain in English. Product localization is separate.

Documentation preparation is tracked under [module 13.3d](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md), with its [session record](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/progress/13-mvp-release-and-operations.md). This skeleton completes no release checklist item and opens no implementation gate.
