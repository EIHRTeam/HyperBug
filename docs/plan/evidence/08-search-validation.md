# Module 08 search validation

## B1 — Public contract prepared, 2026-10-09

Scope: 08.1a–e specification/AST/bounds and 08.V1/V2 fixture preparation. No parser, SQL compiler, route, migration or search index is implemented in B1. Branch `feat/v1`; base commit `1841761`.

Artifacts: [SEARCH-SPEC](../../SEARCH-SPEC.md), [proposed ADR 0013](../../decisions/0013-bounded-search-contract.md), `packages/contracts/src/search.ts`, `tests/fixtures/search-query-contract.ts`, module/master progress records.

Environment: local macOS, Node 24.21.0, pnpm 11.26.0; installed TypeScript 7.0.2, Vitest 5.0.1, oxlint 1.83.0 and oxfmt 0.68.0 (repository package pins). No hosted runtime or database search result is claimed.

### Single verification pass

| Exact command/check | Result and scope |
| --- | --- |
| `corepack pnpm typecheck` | Pass, root/Workers/ingress TypeScript projects; new contracts/fixture types included |
| `corepack pnpm lint` | Pass, oxlint and workspace import boundaries |
| `corepack pnpm test:unit` | Pass, 49 files / 354 existing checks on local Node; 7.96 seconds |
| `corepack pnpm test:contract` | Pass, one existing contract check on local Node |
| Scoped `corepack pnpm exec oxfmt --check` below | Pass, three matched TypeScript files; Markdown paths supplied but not checked by this formatter |
| `git diff --check` | Pass, tracked patch whitespace |
| Inline Python `Path`/regex/URL-decode link check | Pass, nine relative links in the three new engineering documents |

The formatting command was:

```sh
corepack pnpm exec oxfmt --check packages/contracts/src/search.ts packages/contracts/src/index.ts tests/fixtures/search-query-contract.ts docs/SEARCH-SPEC.md docs/decisions/0013-bounded-search-contract.md docs/plan/evidence/08-search-validation.md docs/plan/modules/08-search-and-query.md docs/plan/progress/08-search-and-query.md docs/plan/progress/02-contracts-and-data.md docs/plan/progress/06-issue-core.md docs/plan/progress/07-content-and-attachments.md docs/plan/progress/09-async-and-workflows.md docs/plan/progress/10-backend-acceptance.md docs/plan/PROGRESS.md
```

The new corpus contains ten accepted/resolved-AST examples, seventeen source rejection fixtures, five invalid direct ASTs, and a deterministic 256-input bounded fuzz generator. It is prepared/typechecked, not parser-executed; unchanged unit/contract lanes passing do not close 08.V1/V2 or prove both-store semantics. No skipped/disabled/only tests were introduced. Workerd/PostgreSQL/database/migration checks are not run in B1 because no store/schema/runtime implementation changed. Reader-site/configuration files are unchanged, so docs build and secret scan are not applicable.

Manual design review completes 08.1a/c/d/e specification outcomes. 08.1b remains unchecked until parser/runtime support exists; 08.V1–V6 remain unchecked. Proposed ADR and endpoint/bounds decisions await the handoff-required approval before B2. This conservative checkbox distinction does not change the authorized batch scope.

### Documentation lookup and limits

Context7 resolve-library-id and query-docs ran on 2026-10-09 for SQLite and PostgreSQL, selecting official/high-reputation `/websites/sqlite_docs` and version-specific `/websites/postgresql_18`. SQLite's official corpus returned only the FTS5 documentation pointer; a follow-up query against the resolved Low-reputation `/sqlite/sqlite` mirror supplied tokenizer/escaping/BM25 source excerpts. PostgreSQL returned official parser, simple dictionary and phrase-query documentation. References and matching caveats are in SEARCH-SPEC.

Direct official SQLite fetch via Python 3.14 urllib failed local CA validation (`CERTIFICATE_VERIFY_FAILED`); no insecure TLS fallback was used. Native configuration/Unicode/phrase behavior and projection-size limits must be verified in B2/B3. Drizzle lookups and migrations are deferred to approved B2. modern-web-guidance does not apply: no web/client implementation is changed.

### Review and approval checkpoint

Primary source/contract review: AST/contracts have no database/runtime imports; no new dependency, no public raw FTS syntax, only MVP filter names, explicit pre-database complexity bounds, immutable keyset order, stricter result limits, no per-row hydration design, current canonical visibility/revision checks, no raw query echo, explicit unfinished-index errors. This is a design review, not proof of runtime safeguards.

B1 numeric bounds/AST/endpoint proposal must receive user approval before B2, per HANDOFF-08. Existing normative specifications and protected untracked documents are unchanged. Module 08 stays In progress; G1/G2 closed and 13.G6 open. Dispatch/queue/retry evidence remains the Module 09 handoff; local checks never establish actual Free-plan CPU/quota acceptance.
