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

## B2 — Parser and dual-store compilers, 2026-10-09

User explicitly approved B1 SEARCH-SPEC/bounds/AST v1/dedicated endpoint shapes before B2. Base `c0d0527`. Scope: 08.1b, 08.2a/b/d, 08.V1/V2. No production dispatch, public route, scheduling, reindex or Free-plan acceptance yet; B3 supplies the service/route/current-readiness lifecycle and representative measurements.

### Representation and migration review

D1 `0028_search_index` and PostgreSQL `0027_search_index` were generated with installed drizzle-kit 0.31.11. Derived `search_documents` carries canonical Issue/project identity, revision, projection version, active state, scoped index token and normalized title/text. D1 adds an external-content FTS5 table with insert/update/delete sync triggers; PostgreSQL adds generated simple-config title/body/scoped vectors plus GIN. Canonical Issue writes do not synchronously update this table. Existing Issue state/type/milestone and relation indexes are reused; only the needed project/author/creation index is added. No existing table rewrite, canonical data backfill, changed migration history, dependency version upgrade or destructive SQL. Custom FTS5 DDL is reviewed alongside generated metadata; only the new migration's descriptive filename/journal tag was renamed before local application.

Current canonical visible/not-deleted/project predicates and matching revision/projection version fence all membership, including negative terms. Text posting lists include a project token to restrict candidate intersections. Phrase checks use individual title/body fields, avoiding cross-field matches. Native relevance is unused. The top result window is capped inside SQL before the outer cursor boundary; changing the untrusted cursor count cannot select beyond that current bounded result set. Relations are two fixed page-wide queries (three statements including search), with no per-result fetch.

### Lookup and native refinement

2026-10-09 Context7 resolve/query chose high-reputation `/drizzle-team/drizzle-orm-docs`: generated custom tsvector/GIN columns and unsupported-DDL custom migrations. SQLite follow-up used the already-resolved `/sqlite/sqlite` source mirror for external-content FTS5 triggers; reputation limitation remains. PostgreSQL `/websites/postgresql_18` query covered generated vectors, plain/phrase constructors and GIN rechecks. References: [Drizzle generated FTS guide](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/guides/full-text-search-with-generated-columns.mdx), [SQLite external-content fixtures](https://github.com/sqlite/sqlite/blob/master/ext/fts5/test/fts5content.test), [PostgreSQL FTS tables](https://www.postgresql.org/docs/18/textsearch-tables.html), [GIN](https://www.postgresql.org/docs/18/textsearch-indexes.html).

Real PostgreSQL 18.6's C locale failed `CAFÉ` against indexed `café` before shared preprocessing. Query/index text now uses shared NFC/lowercase/NFC preprocessing, leaving canonical projections unchanged. Final corpus includes uppercase canonical title/diacritics/CJK, literal SQL injection, phrases split across title/body, negative-only terms, all seven filters, null exclusions, empty results, equal-time pagination, cursor/query/version rejection and generated-FTS bounds. Native punctuation/token-class differences remain documented; no test threshold, scanner exclusion or baseline was weakened.

### Commands, results and failure history

Environment: Node 24.21.0; pnpm 11.26.0; Vitest 5.0.1; TypeScript 7.0.2; drizzle-kit 0.31.11; Miniflare 5.20260926.1-alpha/workerd 1.20260926.1; Wrangler 4.144.0; actual local isolated PostgreSQL 18.6/Homebrew (C locale/UTF8). D1 is emulated workerd, not hosted evidence.

| Command/check | Result |
| --- | --- |
| `corepack pnpm db:generate:d1`; `corepack pnpm db:generate:postgres` | Pass; next IDs 0028/0027 verified, additive SQL inspected |
| `corepack pnpm install --lockfile-only --offline`; `corepack pnpm install --offline --frozen-lockfile` | Pass; declare existing workspace contracts dependency for application; no external version changes |
| `corepack pnpm typecheck`; `corepack pnpm lint` | Final pass, including workspace boundaries |
| `corepack pnpm exec vitest run --project unit tests/unit/pagination.test.ts` | 6 pass; three shared parser/corpus/fuzz checks plus existing pagination checks |
| `corepack pnpm test:contract` | One unchanged public-contract check passes |
| `corepack pnpm exec vitest run --project workerd tests/workerd/repository.test.ts -t 'search\|fresh\|upgrade\|migration'` | 14 pass / 163 intentionally unselected; populated prior-history and fresh emulated D1 migrations |
| `corepack pnpm test:postgres tests/postgres/repository.test.ts -t 'search\|fresh\|upgrade\|migration'` | 14 pass / 149 intentionally unselected; real isolated PostgreSQL prior-history/fresh migrations |
| Same store commands with `-t 'search dual-store'` after uppercase source/FTS-bound fixture refinement | 3 pass each; other 174 D1/160 PostgreSQL intentionally unselected. Replaces those three results in the 14-check composed result, not additional distinct checks |
| `corepack pnpm db:check` | Pass; unchanged pre-existing journal timestamp warnings retained |
| `corepack pnpm db:migrate:d1:local` | Pass on hyperbug-local; previously pending 0026/0027 and new 0028 applied locally only |
| `node tooling/postgres-test-cluster.mjs corepack pnpm db:migrate:postgres --apply` | Pass; 0000–0027 applied, pending empty, disposable private Unix-socket cluster stopped/removed |

The first attempted verification was blocked before execution by pnpm's stale installed workspace links after lockfile-only generation; offline frozen install resolved it. First executed static checks rejected parameter-property syntax, TypeScript narrowing/index access and lint control-character/escape/shadow issues; code was corrected without exclusions. First native pass found the C-locale case difference and expected fresh-database counts increased by new objects (D1 guard-trigger count 43→46; PostgreSQL tables 49→50); these assertions reflect the additive schema rather than a weakened bound. Narrow failure fixes/rechecks followed the handoff cadence; no already-green broad lane was rerun.

Scoped formatting/diff and final progress/checklist consistency are recorded before commit. Broad Node/server lanes, hosted deployment, actual quotas/CPU and Module 09 queue/retry are not run/claimed here. The parser corpus executes on Node and native workerd; the same store suite executes on both databases. No skipped/disabled/only test was added; reported skips above are deliberate `-t` deselection.

Final B2 housekeeping: Python supplied `git diff --name-only` plus the eight new application/compiler/fixture/migration/snapshot paths to `corepack pnpm exec oxfmt --check`; 14 matched files pass (generated migration metadata/SQL follows existing formatter exclusions). `git diff --check` passes; staged diff is checked before commit. Protected root drafts remain untracked. No generated measurement JSON drift was present in this scoped pass.

## B3 — Index lifecycle, HTTP authorization and larger-data acceptance, 2026-10-09

Scope 08.2c/f/g, 08.V3/V4. Both roots now bind the approved search/suggestion routes to the shared project-read authorization path. Canonical predicates fence results; missing/stale visible documents fail explicitly; hidden/deleted documents are never authorized through stale hits. Suggestions use a bounded matching first page and current relations. There is no count endpoint or read-triggered repair. Explicit revision-conditional backfill reads 26/11 rows and writes at most 25/10 documents per invocation. Projection gaps are rejected/reportable without changing Module 07.

Shared Unicode token input plus PostgreSQL GIN/plain-query candidates and exact separate-field phrase rechecks preserve phrases at the 32,767-character canonical body limit (16,384 tokens). Native tsvector positions would otherwise collapse at 16,383; repeated-lexeme position storage is separately limited to 256. No canonical body bound was changed.

### Verification and failures

Environment versions remain B2's: Node 24.21.0, pnpm11.26.0, Vitest5.0.1, emulated D1/workerd and actual isolated PostgreSQL18.6. No hosted/Free-plan evidence.

- `corepack pnpm typecheck`; `corepack pnpm lint`: final pass after exact-optional typings and a bounded single PostgreSQL JSON-recordset upsert replaced sequential await-in-loop; no exclusions.
- `corepack pnpm test:workerd tests/workerd/repository.test.ts tests/workerd/issue-route.test.ts -t 'search|late and repeated phrases'`: initial 7 pass/3 fail; the 3 failures were fixture body/time constraints and the test composition's missing search binding. Narrow `-t 'measures bounded search|late and repeated phrases|search HTTP'`: 3 pass. Nine repository plus one HTTP checks pass in the combined selected scope; 172 unrelated checks were deselected.
- `corepack pnpm test:postgres tests/postgres/repository.test.ts tests/postgres/issue-route.test.ts -t 'search|late and repeated phrases'`: initial 8 pass/2 fixture failures. Narrow repository `-t 'measures bounded search|late and repeated phrases|reconciles bounded'`: lifecycle/phrase pass; measurement failed on placeholder ordering in the EXPLAIN harness. Subsequent `-t 'measures bounded search'` found a bulk-load sequential plan, then a wrong expected GIN index name; final pass after VACUUM and exact index-name correction. Combined scope: same 10 checks pass; unrelated cases deselected.
- Workerd narrowed measurement recheck: 1 pass, required to complete previously missing readiness/relation metadata (not another broad green lane).
- Scoped oxfmt and git diff checks are recorded at commit. No schema change in B3; B2 migration evidence remains applicable. Reader-site/configuration files unchanged, so docs build/secret scan not applicable.

### Representative measurements and scan investigation

Committed [D1 plans/metadata](08-d1-search-query.json) and [PostgreSQL EXPLAIN ANALYZE](08-postgres-search-query.json) contain 8,000 canonical/indexed Issues: 2,000 authorized visible, 2,000 deliberately stale hidden hits in that project, and 4,000 private-project distractors; timestamp ties in groups of 20. Each phrase, negative/filter and empty search uses four store statements: bounded canonical readiness, main query and two batched relation queries. No per-result SQL.

D1 main-query rows read are 201 / 4,140 / 2,053; readiness is 6,002; relation reads are 42 / 52 / 52 combined. Total store reads 6,245 / 10,194 / 8,107, all writes zero. Plans use scoped FTS5 virtual-index access, project/creation or project/ID indexes and indexed document witnesses. Temporary bounded-result ordering is expected. Minimum rejects this oversized project after one bounded readiness statement, before FTS.

PostgreSQL's first bulk-load plan scanned 8,000 derived documents (~0.8 ms EXPLAIN execution). VACUUM ANALYZE flushes GIN pending entries and refreshes statistics; the final phrase plan uses `search_vector_gin` plus canonical index lookups (~0.2 ms EXPLAIN execution). The full plans record actual rows/loops/buffers for the three shapes. Empty/negative queries inspect authorized project candidates under the explicit candidate ceiling; indexed relation probes are database joins, not application N+1. Autovacuum/pending-list health is an operator prerequisite after large initial loads, never a request-side maintenance step. Native planner costs are not a guarantee that every small-table plan chooses GIN.

Context7 on 2026-10-09 resolved PostgreSQL18 to high-reputation `/websites/postgresql_18`, then queried GIN/VACUUM. Official [GIN implementation](https://www.postgresql.org/docs/18/gin.html), [VACUUM](https://www.postgresql.org/docs/18/sql-vacuum.html) and [pending cleanup](https://www.postgresql.org/docs/18/functions-admin.html) confirm this mechanism. Initial Elysia resolve returned an unavailable-credential message; existing repository route patterns plus native HTTP checks supplied syntax evidence. Prior D1 quota lookup gaps remain open; B4 must implement/verify local admission without claiming actual provider quota/CPU.

### Review and boundaries

Focused source review: fixed safe errors; project visibility precedes readiness; private membership loss and canonical revision/moderation exclusion; conditional index writes; bounded Unicode/SQL input; separate-field phrase behavior; strict window/pagination; no raw bodies in summaries or errors. No new dependency, dispatch/scheduler or normative-document edit. G1/G2 stay closed, 13.G6 open. B4 still owns version-aware events, durable quota admission and authorized operator reindex.
