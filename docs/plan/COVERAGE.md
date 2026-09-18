# Requirement coverage and integration handoffs

This map assigns implementation and verification ownership to the source requirements. Detailed checklists and source section references live in the [module plans](README.md#module-index).

## Product and engineering coverage

| Requirement | Implementation owner | Acceptance/evidence owner |
| --- | --- | --- |
| English guidance skills first; English documentation default | 00 | 00; all session logs |
| Every-session progress, change summaries, and next-session cautions | EXECUTION protocol; every module | Per-module progress; master status |
| Reproducible pnpm/Node/TypeScript workspace and dependency policy | 01 | 01, 13 |
| Shared Elysia server with two independent runtime entries | 01 | 01, 10 |
| Domain/repository/contracts isolation and separate migrations | 02 | 02, 10, 13 |
| IDs, Issue numbers, timestamps, deletion, concurrency, outbox | 02 | 02, 06, 09 |
| Framework-independent REST/OpenAPI and official API client | 02, feature modules, 10 | 10 |
| Crypto/key providers/rotation, credential hashing, redaction | 03 | 03–04, 10, 13 |
| Anti-abuse, consistent sensitive limits, outbound SSRF policy | 03 | 03, 07, 09–10, 16 |
| Public User/Staff separation, PKCE, session/token lifecycle | 04 | 04, 10–11 |
| Object permissions, roles, bootstrap/recovery, assurance | 03–04 | 04, every resource module, 10 |
| Projects independent of Git repositories | 06 | 06, 10, 12 |
| Issues, comments/history/permalinks, reactions | 06 | 06, 10, 12 |
| Labels, assignees, types, milestones, close/reopen | 06 | 06, 10, 12 |
| Unified timeline and immutable security audit | 02–03, 06 | 06, 10, 12 |
| GFM, limited raw HTML, centralized sanitization | 07 | 07, 10, 12 |
| Markdown representation/transport policy, plain-text projection, derivation cost | 07 | 07, 10, 12 |
| Bounded content pagination and cursor stability across policy versions | 02, 07 | 07, 10, 12 |
| Issue Templates and all structured Issue Form field types | 07 | 07, 10, 12 |
| R2/S3 direct upload, multipart, quarantine, isolated media | 07 | 07, 09–10, 12–13 |
| Search language/AST, filters, sort, FTS5/GIN, authorization | 08 | 08–10, 12 |
| Queue/outbox, retries/DLQ, idempotency and backpressure | 09 | 09–10, 15–16 |
| Workflow adapter parity and cleanup/retention | 09 | 09–10, 13, 15 |
| Static SPA, runtime config, independent domains/hosting | 11 | 11–13 |
| Baseline compatibility, WCAG 2.2 AA, modern web fallbacks | 11–12 | 11–13; SOURCES research |
| Complete MVP public/staff web journey | 12 | 12–13 |
| Migration/backup/restore, releases, supply-chain integrity | 01–02, 13 | 13 |
| Observability, query/bundle/load regression, measured budgets | 01, every module | 10, 12–13 |
| Sub-issues, dependency/duplicate/related relations | 14 | 14 backend gate, then UI acceptance |
| Saved views | 14 | 14 backend gate, then UI acceptance |
| Subscriptions, notifications, bulk actions, import/export | 15 | 15 backend gate, then UI acceptance |
| Plugin API/SDK/runtime/registry and build-time UI extension | 05, 11 | 05, 09–10, 16 |
| Internal SSO, three CAPTCHA providers, email/webhook/GitHub | 16 | Per-provider acceptance and release checks |
| Deferred AI/boards/realtime/SCIM/untrusted runtime execution | Explicit exclusions in README and 16 | Must not block MVP |

## Cross-module contracts and handoffs

| Producer | Deliverable | Consumer | Integration check |
| --- | --- | --- | --- |
| 00 | Registered development/maintenance skills and session protocol | All later modules | Every session start/end |
| 01 | Runtime app factory, configuration, telemetry/test harness | 02–10 | Both-runtime CI |
| 02 | DTOs, repository ports, migration pattern, atomic event/outbox contracts | 03–09 | Shared semantic tests and 10 |
| 03 | Permission/crypto/audit/abuse/outbound policies | 04–16 | Security regressions per feature |
| 04 | Auth protocol, principals/assurance, role/permission APIs | 05–16 | Cross-site and object-level checks |
| 05 | Manifest/SDK/hooks, capability and event contracts | 06–09, 11, 16 | Plugin compatibility tests |
| 06 | Issue/comment/taxonomy services and events | 07–09, 12, 14–16 | API journey and timeline consistency |
| 07 | Forms, sanitizer, safe representation, plain-text projection, BlobStore, upload/cleanup handlers | 09–12, 15 | Direct-upload, cleanup, corpus, representation-determinism and derivation-cost tests |
| 08 | AST/compiler and version-aware index handlers | 09–12, 14 | Search parity and stale-index checks |
| 09 | Dispatch, retry/DLQ, workflow state, scheduled cleanup | 10, 13, 15–16 | Crash/replay/recovery tests |
| 10 | Accepted backend, OpenAPI, public API client | 11–12 | G1 must pass before SPA work |
| 11 | Static shell, browser auth, accessible primitives | 12, 14–16 | Browser/cross-site/CSP tests |
| 13 | Deploy/upgrade/restore/release procedures | 14–16 and maintenance | Repeat for each later increment |

## MVP integration checkpoints

- [x] **C1** G0: guidance skills exist and are discoverable before any product implementation.
- [ ] **C2** Persistence and auth behavior agree across both profiles before feature expansion.
- [ ] **C3** Plugin, content cleanup, and search handlers are wired to durable dispatch before backend acceptance.
- [ ] **C4** G1: module 10 backend gate passes before the SPA is scaffolded.
- [ ] **C5** G2: module 13 accepts the complete MVP, deployment, security/performance, and recovery path.
- [ ] **C6** Each post-MVP module accepts its backend before exposing its frontend.

These integration checkboxes summarize evidence owned by module plans. Update them only when the owning acceptance items pass; they do not replace module checklists or session records.

