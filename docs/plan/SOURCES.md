# Architecture source register and research notes

Planning date: 2026-09-17. This file records the sources consulted, their planning implications, and what still needs implementation-time verification. It is not a claim that all listed dependencies or cloud features were installed or tested.

## Initial architecture inputs

| Source shorthand | Responsibility |
| --- | --- |
| [PRODUCT](../initial-architecture/PRODUCT.md%20%E2%80%94%20%E4%BA%A7%E5%93%81%E5%AE%9A%E4%BD%8D%E3%80%81%E8%A7%84%E5%88%92%E4%B8%8E%E8%BE%B9%E7%95%8C.md) | Product scope, identity domains, MVP/post-MVP boundaries, and exclusions. |
| [ARCHITECTURE](../initial-architecture/ARCHITECTURE.md%20%E2%80%94%20%E6%8A%80%E6%9C%AF%E6%9E%B6%E6%9E%84%E4%B8%8E%E5%B7%A5%E7%A8%8B%E5%9F%BA%E7%BA%BF.md) | Modular boundaries, static frontend, contracts, modern web, and engineering baseline. |
| [TECH-STACK](../initial-architecture/TECH-STACK.md) | Refined dual-runtime deployment profiles, adapter boundaries, version policy, and data-model priorities. |
| [SECURITY](../initial-architecture/SECURITY.md%20%E2%80%94%20%E5%AE%89%E5%85%A8%E6%9E%B6%E6%9E%84%E4%B8%8E%E5%9F%BA%E7%BA%BF%E8%A7%84%E8%8C%83.md) | Normative authentication, authorization, cryptography, content, plugin, and operational security. |
| [PERFORMANCE](../initial-architecture/PERFORMANCE.md) | Normative bounds, query shape, caching, async work, observability, and measurement. |

Module source sections use these shorthand names and the numbered sections inside each source. The [coverage map](COVERAGE.md) connects requirements to implementation owners.

## Source precedence and reconciliations

1. The user requires guidance skills first, backend development before frontend development, per-module progress records updated every session, and English documentation by default.
2. PRODUCT defines product scope. SECURITY defines security requirements; library defaults and plugins cannot weaken them. PERFORMANCE explicitly prioritizes security/correctness over optimization.
3. TECH-STACK explicitly refines earlier infrastructure and version decisions. Its two first-class profiles and adapter model govern this plan.
4. ARCHITECTURE remains the baseline where not refined by TECH-STACK. Unresolved normative conflicts require a recorded decision rather than an implicit compromise.

| Earlier wording or ambiguity | Planning resolution | Owner |
| --- | --- | --- |
| Workers-centric backend and single `apps/api` | Shared server/application code with `apps/api-cloudflare` and `apps/api-node`; both production profiles are mandatory | 01–02, 10, 13 |
| D1/R2-only descriptions | D1 and PostgreSQL repositories plus R2 and S3 BlobStore adapters share product semantics | 02, 07 |
| Vite 8 / unspecified Vitest major | Track latest stable Vite/Vitest through reviewed updates and a frozen lockfile; exact installation versions are verified later | 01, 11 |
| Source examples of PostgreSQL/TypeScript/pnpm/Drizzle versions | Preserve declared major/policy choices; treat dated patch/RC examples as snapshots, not guaranteed currently available releases | 01 |
| Elysia Node adapter names differ between source and retrieved material | Verify the actual published package/export and supported version before installation; do not guess from a historical excerpt | 01 |
| Drizzle used for both databases | Separate schemas/migrations/SQL; shared repository behavior and transaction intent, not a single dialect or universal transaction callback | 02 |
| Plugin-first versus deferred untrusted runtime code | Implement trusted registry/runtime/SDK and external protocol boundaries in MVP; defer an arbitrary untrusted-code hosting platform | 05, 16 |
| Workflow foundation versus later imports/exports | Prove durable adapter semantics in MVP; add user-facing bulk/import/export after MVP | 09, 15 |
| Optional email/SSO versus functional accounts | Choose and test usable Core account/bootstrap/recovery flows without mandatory email/SSO; provider-specific implementations stay optional | 04, 16 |
| Source security/performance docs are primarily Cloudflare-oriented | Enforce the same security, bounds, and recovery semantics in Node/PostgreSQL/S3 | 03–10, 13 |
| Existing architecture files are not English | All new plans/progress/specifications/skills/runbooks use English; existing inputs remain historical unless separately translated | 00 and every module |

Workers + PostgreSQL through Hyperdrive is architecturally possible but is not a guaranteed profile in this plan. Do not generalize source-time support claims or advertise PostgreSQL 18 compatibility without current provider and integration evidence.

## Context7 research

The context7-mcp skill was read, and resolve-library-id was called before query-docs for each library. Official/high-reputation documentation sources were chosen based on name, relevance, and coverage.

| Library ID | Findings used in the plan | Limits and follow-up |
| --- | --- | --- |
| `/elysiajs/documentation` | Workers AOT guidance, runtime API limitations, Node adapter examples, schema-based OpenAPI | Results include historical blog/migration excerpts with differing package names. Verify current adapter names, versions, flags, encapsulation, and generated OpenAPI in 01/10. |
| `/drizzle-team/drizzle-orm-docs` | D1 batch API, separate PostgreSQL migrations/transactions, cursor pagination | Generic transaction examples do not prove D1 callback support or the chosen PostgreSQL driver. Test atomic business outcomes and actual drivers in 02. |
| `/cloudflare/cloudflare-docs` | D1 batch rollback/implicit transactions; durable Workflow steps and serializable checkpoints | Retrieved results did not substantively cover R2 signing or Queue delivery details. Those requirements come from initial architecture and remain mandatory current-doc/runtime checks in 07/09. |

Primary references returned by Context7:

- [Elysia Cloudflare integration documentation](https://github.com/elysiajs/documentation/blob/main/docs/integrations/cloudflare-worker.md): AOT support/recommendation and Workers restrictions, including filesystem-dependent features.
- [Elysia 1.2 Node adapter example](https://github.com/elysiajs/documentation/blob/main/docs/blog/elysia-12.md): historical adapter example; not sufficient to pin a current package name.
- [Elysia OpenAPI migration example](https://github.com/elysiajs/documentation/blob/main/docs/migrate/from-trpc.txt): schema-driven OpenAPI, subject to package/version verification.
- [Drizzle D1/SQLite batch documentation](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/sqlite/batch-api.mdx): batch support rather than an assumption of full runtime-independent transactions.
- [Drizzle PostgreSQL migrations](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/pg/migrations.mdx): migration generation and application.
- [Drizzle cursor pagination](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/guides/cursor-based-pagination.mdx): ordered cursor comparisons; HyperBug adds stable tie-breakers and contract limits.
- [D1 database/batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch): failure rollback of a batch. Application-level zero-row/conflict cases still require explicit invariant tests.
- [Cloudflare Workflows guide](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workflows/get-started/guide.mdx): durable steps, retries, and serializable step results.

No current implementation proof was performed during this planning session. Better Auth, Graphile Worker, AWS SDK, frontend libraries, and external integration providers require focused Context7/official-doc verification when their modules begin.

## Modern web guidance

The explicitly requested modern-web-guidance skill was read and executed through `pnpx`, since pnpm was available. Search preceded retrieval. Skill version supplied: `2026_09_04-7de96777`.

Searches used:

```sh
pnpx modern-web-guidance@latest search "Build an accessible issue tracker with long searchable lists, forms, dialogs and safe rich content" --skill-version 2026_09_04-7de96777
pnpx modern-web-guidance@latest search "Defer rendering long issue lists and timeline content while preserving accessibility and browser find" --skill-version 2026_09_04-7de96777
pnpx modern-web-guidance@latest search "Use native dialog for accessible confirmation with keyboard focus management" --skill-version 2026_09_04-7de96777
pnpx modern-web-guidance@latest retrieve "forms,accessible-error-announcement"
pnpx modern-web-guidance@latest retrieve "defer-rendering-heavy-content,platform-controls-dismiss-dialog"
```

| Retrieved guide | Concrete application | Compatibility and adaptation |
| --- | --- | --- |
| `forms` | Semantic form controls, visible labels, help/error associations, native constraints, input/autofill support, touch usability, IME-safe submission | Client validation is UX only. Keep server validation authoritative. No new analytics or payment features are implied. |
| `accessible-error-announcement` | Synchronize visual and ARIA invalid state after interaction, clear corrected errors, test error summary and announcements | Guide labels user-valid/user-invalid widely available. Recheck support at implementation; avoid duplicate announcements and unnecessary fallback bundles. |
| `defer-rendering-heavy-content` | Profile long timelines; optionally defer only heavy content below the initial viewport, with intrinsic-size reservation | Treat as progressive enhancement per retrieved guidance. Normal rendering must work without support. Check sequential keyboard access and find-in-page; never use hidden rendering as an authorization boundary. |
| `platform-controls-dismiss-dialog` | Proper modal opening, visible close/cancel, Escape, focus restoration, optional platform dismissal | Guide describes closedby as limited availability. Extra gestures/light-dismiss are optional; core dismissal must work without them. |

### Project-specific adaptations

The forms guide contains general server-rendered/cookie-flow advice and sample snippets that are not automatically suitable for this project:

- Keep the static SPA and cross-site bearer API architecture. A no-JavaScript notice is appropriate for the product SPA; adding SSR or a mandatory same-origin form backend is not.
- Apply cookie CSRF controls to the authorization service. Business APIs retain bearer authentication, strict CORS/origin validation, and omitted credentials; do not send tokens in URL parameters to imitate native form fallback.
- Use the centralized versioned GFM/raw-HTML sanitizer rather than introducing a second component-local sanitizer from a sample.
- Follow the source CSP policy. Do not copy inline handler examples or relax CSP for convenience.
- Preserve the selected accessible Base UI/shadcn composition where suitable. Native-dialog guidance informs behavior; it does not force replacement of a working accessible primitive without evidence.
- Compatibility dates in retrieved guides are research snapshots, not a new permanent browser support list. Refresh the specific feature's current status before adopting it.

No frontend code was created, so this session verified planning coverage and compatibility/fallback requirements rather than claiming implementation compliance.

## Decisions to close during execution

| Decision | Required outcome | Module |
| --- | --- | --- |
| Toolchain/package availability | Exact installable versions, adapter names, compatibility proof, or an explicit blocker/ADR | 01 |
| IDs, time, deletion, consistency | DATA-MODEL with both physical mappings and concurrency tests | 02 |
| Auth library and no-email accounts | Working protocol/assurance/bootstrap/recovery PoC on both profiles | 04 |
| Native/external extension boundary | Versioned manifest/API, lifecycle, capability and failure semantics | 05 |
| Upload immutability and quotas | Proven finalize/overwrite/race handling on R2 and S3 | 07 |
| Search language and indexing delay | Shared documented semantics, limits, language/ranking choices, and rebuild | 08 |
| Queue/workflow semantic differences | Crash/replay/idempotency and bounded scheduling evidence | 09 |
| Performance budgets and support claims | Measured results with environment, fixture, versions, and required checks | 10, 13 |

