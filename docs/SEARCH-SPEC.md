# Bounded Issue search, version 1

Status: Approved by the user on 2026-10-09; B1–B4 implemented and verified locally; dispatch/queue integration and hosted tier acceptance remain open. Module 08 owns implementation; module 09 owns production dispatch and scheduling. This specification supplements the existing [API conventions](API-CONVENTIONS.md), [data model](DATA-MODEL.md) and [permission matrix](API-OPERATIONS.md); it changes none of their normative baselines.

## Approved endpoint decision

Use `GET /api/v1/projects/:projectId/search?q=...&limit=...&after=...` for search and `GET /api/v1/projects/:projectId/search/suggestions?q=...&field=...` for structured filter suggestions. Dedicated routes make the stricter search budget explicit. Both use the existing project-read authorization path and cursor envelope rules. The ordinary Issue list retains its current behavior. Only these two operation shapes are proposed; no global search, saved views or public reindex endpoint is introduced.

Search returns the existing `{ items, nextCursor }` Issue summary representation. No body, snippets, score or total count is added. Suggestions return `{ items: [{ field, value }] }`, with at most ten distinct currently applicable values; fields are the seven filters below, values are canonical identifiers or state literals. Suggestions derive from currently authorized, visible matching Issues, never from an unchecked index or the entire taxonomy/principal directory. Their internal aggregation applies the same canonical checks as results. There is no unlimited count operation.

Unknown request keys and invalid `limit`, `after` or `field` fail validation. `q` defaults to the empty query. Suggestions accept a complete valid query, not a second partial-query language. Both endpoints are `no-store`. Current authentication, Origin and admission policies remain mandatory; public/private visibility is decided before querying an index. B2 approval covers these endpoint shapes before route code or migrations are written.

## Grammar and interpretation

```ebnf
query     = [ branch, { whitespace, "OR", whitespace, branch } ];
branch    = predicate, { whitespace, predicate };
predicate = [ "-" ], ( word | quoted | filter );
filter    = field, ":", ( word | quoted );
field     = "state" | "label" | "assignee" | "milestone" |
            "type" | "author" | "project";
quoted    = '"', { character | '\\"' | '\\\\' }, '"';
```

Whitespace is Unicode whitespace. Adjacency means AND; standalone uppercase `OR` separates branches. Negation applies only to the immediately following predicate. For example, `crash state:open -label:<uuid> OR "startup failure" state:closed` is two conjunctions. A literal `OR` must be quoted. Lowercase `or` is a text term. Empty/whitespace-only query is one empty conjunction and selects authorized visible Issues under the search budget. Contradictory predicates and well-formed nonexistent IDs produce an empty result, not a validation error.

Inside quotes only `\"` and `\\` escape a quote and backslash. Other escape sequences, unclosed quotes, empty quoted values, bare backslashes, repeated leading negation, missing filter values and empty OR branches are syntax errors. Bare words cannot contain quotes, colons, parentheses or backslashes; a colon separates a filter name from its value. To search punctuation such as a URL, quote it. Parentheses, AND/NOT/NEAR operators, wildcards, regexes, ranges, field-scoped FTS expressions and nesting are unsupported. Reserved standalone `AND`, `NOT`, `NEAR`, `*`, `&` and `|` fail safely; quoted equivalents are literal text. No raw database query language is accepted.

Predicates are not reordered across OR branches by the parser. Normalize text and filter values to NFC; normalize state literals to lowercase. Text case handling is described below. A quoted text predicate is a token phrase; a bare text predicate uses its tokenizer's tokens conjunctively. A quoted filter value is still an exact filter value, not a phrase. Negative-only and filter-only queries are allowed only under the same bounded canonical access budget; they never cause an unbounded complement scan.

## MVP filters and principal resolution

| Filter | Accepted value and behavior |
| --- | --- |
| `state` | `open` or `closed`; exclusion means the other state |
| `label` | Lowercase UUID; positive predicates require that label, exclusions forbid it; repeated positives require all labels |
| `assignee` | Staff principal UUID or `me`; matches current Issue assignment, exclusion matches absence of that assignment |
| `milestone` | Milestone UUID; exact current reference, exclusion includes null |
| `type` | Issue type UUID; exact current reference, exclusion includes null |
| `author` | Principal UUID or `me`; exact immutable author |
| `project` | Project UUID; intersects the route project; a different positive project yields no results |

Names, handles, `none`, aliases such as `is`, and additional filters are unsupported in v1. UUID values avoid ambiguous renames and cross-project lookup/oracle behavior. Suggestion values are ready for insertion into the query. The example placeholders `<uuid>` must be replaced by actual lowercase UUIDs.

Resolve `me` only in `author` and `assignee`, from the authenticated principal ID before compilation and cursor fingerprinting; no caller-supplied identity overrides it. Missing principal produces `SEARCH_PRINCIPAL_REQUIRED`. A User principal may use `assignee:me`, but receives no matches because assignments require Staff; negation follows ordinary absence semantics. Staff and User identities remain distinct. Explicit valid IDs do not grant access to those principals/projects, and unknown IDs are not probed to generate errors.

## Independently versioned AST and bounds

The exported contract is [search.ts](../packages/contracts/src/search.ts). `version: 1` is independent of REST, cursor, projection and plugin versions. It is an OR array of AND arrays of leaf predicates, with an explicit `sort: ["created_desc"]`. A leaf has either `{ kind: "text", value, phrase, negated }` or `{ kind: "filter", field, value, negated }`. `me` is replaced by the principal UUID in a resolved AST. Unknown fields, wrong scalar types, unsupported versions and noncanonical values must fail validation even when a caller constructs an AST directly. There is no public AST submission endpoint in this increment.

```json
{
  "version": 1,
  "branches": [[
    { "kind": "text", "value": "startup failure", "phrase": true, "negated": false },
    { "kind": "filter", "field": "state", "value": "open", "negated": false }
  ]],
  "sort": ["created_desc"]
}
```

| Dimension | Version 1 maximum |
| --- | ---: |
| Query Unicode code points / UTF-8 bytes | 512 / 2,048 |
| Decoded individual predicate value code points | 128 |
| Semantic AST depth (root / conjunction / predicate) | 3 |
| Total predicates across all branches | 16 |
| OR branches | 4 |
| Negated predicates across all branches | 8 |
| Label predicates across all branches, including exclusions/duplicates | 8 |
| Sort fields | 1 |
| Generated FTS expression UTF-8 bytes across all leaves | 4,096 |
| Cursor envelope bytes | 1,024 |

The fixed AST excludes recursive grouping and combinatorial distributive expansion. Reject source size before tokenization, and predicate/branch/value/negation/label/depth limits before any repository call. Compilers measure generated FTS expression size before issuing SQL. Do not silently truncate, drop predicates, reinterpret unsupported syntax or widen a bound. Bounds semantics are versioned with the AST; a changed policy must not silently reuse an old fingerprint.

| Deployment tier | Default page | Maximum page | Maximum results in one cursor traversal |
| --- | ---: | ---: | ---: |
| Standard (both stores) | 20 | 25 | 200 |
| Cloudflare Minimum | 10 | 10 | 50 |

These are contract ceilings, not measured capacity claims. Fetch at most `limit + 1` authorized summaries, hydrate relations in fixed bounded batches, and never perform relation queries per result. Traversal cannot pass the tier result window; return `SEARCH_WINDOW_EXHAUSTED` rather than imply an exhausted dataset. B3/B4 must measure and enforce row/statement/admission budgets and bounded operator indexing within the [Free-tier ceilings](FREE-TIER-PROFILE.md#capacity-ceilings-and-quotas); a limit on returned rows alone is insufficient scan evidence. No Free CPU/quota acceptance is claimed by defining these numbers.

## Text, language, ranking and stable pagination

Index only current canonical Issue title plus the existing persisted versioned plain-text body projection. Do not parse Markdown at search time, index comments/history/raw HTML, or invent another projection. Missing projection is unfinished indexing, not evidence of a nonexistent/unauthorized Issue.

Use SQLite FTS5 `unicode61 remove_diacritics 0` and PostgreSQL `simple` text-search configuration with no stemming or stop-word removal. Normalize input/index text with shared NFC/lowercase/NFC preprocessing and space-delimited Unicode letter/number/mark tokens before native tokenization (the B2 PostgreSQL C-locale fixture otherwise fails uppercase accented text). ASCII case is insensitive; diacritics are significant (`café` differs from `cafe`). Shared JavaScript Unicode lowercasing defines non-ASCII case preprocessing; native parser Unicode/category differences still require the shared corpus. There is no automatic language detection, stemming, transliteration or CJK segmentation. Contiguous CJK words require the same contiguous term; substring matching is not promised. Emoji and punctuation-only positive text predicates match nothing; their exclusion does not remove rows. Phrase means consecutive normalized tokens within title or body, never across their boundary.

Derived token strings retain leading/trailing spaces. PostgreSQL GIN/plain-term queries select candidates; quoted phrases additionally recheck the exact token sequence within one field. This avoids PostgreSQL position truncation (16,383 maximum position and 256 positions per lexeme) without changing the canonical projection. SQLite compiles the same token sequence as an FTS5 phrase.

Shared preprocessing splits punctuation before either native parser, removing URL/email/hyphen token-class differences from the indexed input. PostgreSQL simple and SQLite unicode61 still depend on their native Unicode/category rules; obscure combining-mark or Unicode-version differences are not promised byte-identical. The common corpus verifies the published text/filter/authorization/cursor behavior on both stores. No extension, custom dictionary or tokenizer dependency is introduced to hide those differences.

V1 exposes only `created_desc`, ordered by immutable `(created_at DESC, id DESC)`, with strict tuple comparisons. Relevance ordering and mutable timestamp sorts are not public sort modes. FTS5 BM25 and PostgreSQL `ts_rank` are different algorithms and score scales; neither affects pagination or appears in responses. No cross-store ranking parity is claimed.

Extend the existing v1 cursor envelope and its strict validation, not a second pagination scheme: bind resource, route project, normalized/resolved AST and sort fingerprint, tier/window policy, traversal count, and the last immutable tuple. Existing list cursors continue to work for their original operation. The current implementation's Issue cursor contains `state` rather than a general fingerprint; search adds the specified fingerprint as part of extending that envelope. Include the AST/bounds version, scan ceiling, tokenizer policy and resolved `me` identity in fingerprint input; cursor `policy: 1` independently retires incompatible execution policies (B2/B3 pre-release cursors without that field are retired); exclude formatting differences. Validate the cursor before expensive work. Project/query/sort/tier mismatch is `INVALID_CURSOR`; retired policy/version is `CURSOR_STALE`. A cursor is never an authorization capability. Each page uses current canonical authorization; inserts/deletions and mutable filters follow the existing live traversal rules, with no snapshot promise.

## Structured errors and availability

Use the existing `{ error: { code, message, requestId } }` envelope. Messages are fixed, bounded, and contain no input, SQL, index text or hidden IDs. No new error response fields are required.

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `SEARCH_SYNTAX` | 400 | Invalid quoting/escaping, missing value or malformed branch |
| `SEARCH_UNSUPPORTED` | 400 | Unknown filter/operator/sort |
| `SEARCH_VALUE` | 400 | Invalid state, identifier or filter value |
| `SEARCH_PRINCIPAL_REQUIRED` | 400 | `me` requires an authenticated principal |
| `SEARCH_COMPLEXITY` | 400 | An explicit source/AST/FTS bound is exceeded |
| `SEARCH_VERSION` | 400 | Unsupported AST version |
| `INVALID_CURSOR`, `CURSOR_STALE` | 400 | Existing cursor validation/retirement errors |
| `SEARCH_WINDOW_EXHAUSTED` | 400 | Refresh/narrow the query; traversal ceiling reached |
| `SEARCH_BUDGET_EXHAUSTED` | 503 | Query/scan/quota allowance unavailable; retry or narrow the query |
| `SEARCH_INDEX_INCOMPLETE` | 503 | Authorized project's initial/reconciliation index is not ready |
| `SEARCH_UNAVAILABLE` | 503 | Search store/index timeout or transient failure |

Existing authentication/admission/404 errors remain applicable. Resolve project visibility first, so an index readiness/budget error never reveals a private project's existence. Never return an empty successful page for unavailable/unfinished search, never fall back to an unbounded relational/body scan, and never weaken authorization to serve a partial index. Direct Issue access continues through the ordinary canonical read path.

## Consistency and implementation handoff

Search is an eventually consistent derived view; canonical data owns identity, fields and authorization. Recheck canonical project access and Issue `moderation = visible` / not deleted for results, suggestion values and internal counts even with stale index rows. Hidden/redacted/deleted content is excluded from search for Staff too; authorized moderation reads remain separate. Compare indexed revision/projection version with canonical facts before allowing old text to select a result; stale text cannot survive an edit/redaction through index membership alone.

The operational delay target is 60 seconds after a committed Issue change; this is an alert/reconciliation target, not a delivered queue SLA before Module 09. Until reconciliation catches up, any missing/stale visible document causes `SEARCH_INDEX_INCOMPLETE` for the authorized project. There is no partial-success fallback. A revision-checked explicit `SearchIndexStore.backfill` reads at most 26 rows and updates 25 documents per Standard call, or reads 11/updates 10 on Minimum. Resume its opaque Issue-ID checkpoint in a later operator invocation; never run a startup or request-time sweep. Missing canonical projections are reported as rejected IDs to the authorized operator and left for Module 07. Cancellation is checked before reads and each write. Conditional writes compare revision, projection, moderation and deletion, and cannot overwrite a newer document. Hidden/deleted rows have inactive empty derived text. Retry a failed checkpoint at most three times with 1/5/30-second delays supplied by Module 09/operator orchestration; then stop and retain a failure. Reconciliation starts again from the beginning periodically using bounded calls; a cursor past a concurrently inserted lower ID is not a complete-index guarantee. Readiness checks current canonical facts independently. No production scheduler is included.

Readiness and the main SQL statement independently bound the canonical project candidate set to 4,096 total Issues on Standard and 256 on Minimum, with one sentinel. Larger projects receive `SEARCH_BUDGET_EXHAUSTED`; results are never silently sampled. The bound counts hidden/deleted rows too. An authorized ID-only materialized CTE with a sentinel also fences the main statement, so project growth after readiness cannot expand the scan or produce a partial successful page. Its internal overflow marker is converted to the fixed budget error and never enters a public summary. These are invocation candidate ceilings, distinct from the 200/50 result window. The shared route wraps store work in at most 1,000 ms (or the smaller configured read deadline). A timed-out D1 operation may still finish; no repair write is launched by a read. PostgreSQL's composition root additionally uses physical `statement_timeout: 1000`. Search failures do not affect direct canonical Issue access. Suggestions select at most the tier's maximum first-page matches, deduplicate current field values and return at most ten; they do not promise exhaustive taxonomy discovery.

PostgreSQL builds that ID set with recursive, ordered `(created_at, id)` index probes, each limited to one row. Canonical summaries are fetched by project/ID once per candidate into a second materialized CTE; no raw Markdown body is selected. Each text leaf has its own materialized, scoped GIN hit set, with exact phrase rechecks. Text work requires a nonempty authorized candidate set within the ceiling. This avoids the observed global canonical scan and posting-list cross product at the cost of bounded per-candidate database probes. The representative plan checks both index usage and actual canonical loops/rows; a logical LIMIT alone did not establish this property.

## Version-aware handler and operator reindex

`handleSearchIndexEvent` accepts an internal version-1 project/Issue/revision reference. Read canonical rows at exactly that revision; an older or not-yet-current event performs no index update. Events contain no trusted replacement text. Replayed current events suppress unchanged writes. Conditional writes still recheck current revision, projection, moderation and deletion at commit. Deletes/redactions empty derived title/body and mark the document inactive. A new canonical event or periodic bounded reconciliation recovers read/write races.

`handleSearchOutboxEvent` bridges the existing Module 02 outbox `{projectId, aggregateId, eventType, payload: {issueId, mutationId}}`: resolve the immutable timeline witness's aggregate revision, then invoke the same handler. Missing witnesses fail safely for retained retry; unsupported/malformed messages fail before indexing. No producer payload, canonical write path, queue, lease, scheduling or dispatch code changes. Module 09 connects dispatch, retry/backlog/dead-letter policy and periodic reconciliation, then verifies delivery together before G1.

`reindexSearch` is an exported server/operator service, not a public HTTP endpoint. Supply a server-composed `SearchContext` and the administrator's bearer Request, route project, and optional `after`/`limit`; it runs the existing project-read and sensitive `project:configure` guards (current administrator and fresh token) before one bounded `backfill` page. Never accept caller-created authorization facts/context in a public route. Pass the returned checkpoint to a later separately authorized invocation; do not loop inside one request. The deployment roots bind the index store; isolated fixtures can directly call the lower-level trusted port before dispatch exists. This task does not supply an administrator UI or a new CLI/endpoint.

## Minimum quota admission and measured limits

A singleton primary-store daily reservation ledger (`D1 0029_search_budget`, `PostgreSQL 0028_search_budget`) permits at most 1,000,000 reserved reads and 20,000 reserved writes per UTC day for search/index work. Atomic compare-and-update prevents concurrent over-allocation; advancing a day resets the counters, while a backwards clock cannot reset them. There is no refund on error, cancellation or replay. Standard has the same candidate/window/deadline bounds without this daily allocation. Node still refuses Minimum as a deployment profile; PostgreSQL tests exercise portable port semantics only.

Each Minimum search/suggestion reserves 20,000 reads and eight writes before readiness/FTS work. Each index page reserves 2,000 reads and `8 + 512 × limit` writes (at most 5,128). The conservative envelope includes ledger overhead; authentication/admission and other modules use the remaining provider allocation. Search uses the existing authoritative `search` IP/route admission (30/120 per minute for Minimum/Standard, fixed server route subject and trusted root IP). D1 meters search work against four statements/20,000 reads/no index writes; indexing against `limit + 1` statements/2,000 reads/`8 + 512 × limit` writes. Bad/unavailable metadata fails closed. A metered overrun stops subsequent work and returns the fixed budget error; an already-executed SQL statement cannot be cancelled retroactively. The independent candidate fence bounds each main statement before full result evaluation.

Native local evidence: ten 28,667-character bodies with 6,000 distinct tokens each index in eleven D1 statements and 54–55 reads/46 writes, well inside reservations; local read/write exhaustion rejects before index reads/writes, retains existing documents and keeps direct canonical reads available. These conservative reservations permit fewer requests than an actual row-count accounting system; operators must not raise them without new bounds/evidence. The total D1 allowance (5M reads/100k writes/day) is shared with other applications/databases: this ledger does not observe account-wide consumption. Module 09/13 must budget the remaining 4M/80k and retain actual provider headroom; actual provider exhaustion can make all D1 reads unavailable. Search's local allocation exhaustion is distinct from provider-wide outage.

Provider quota errors map to `SEARCH_BUDGET_EXHAUSTED`; timeouts/unknown failures map to `SEARCH_UNAVAILABLE`, with fixed messages. Documentation confirms daily-quota failure and metadata but not every provider error spelling or FTS internal accounting. Emulator metadata is not billing evidence. Invocation wall time includes D1 I/O and is not Worker CPU time. No 10-ms actual Free CPU, hosted quota exhaustion or 13.G6 acceptance is claimed; queue/retry acceptance remains Module 09.

## Research and acceptance status

Context7 resolve-then-query on 2026-10-09 selected `/websites/sqlite_docs` (official/high reputation, but only an FTS5 pointer) and `/websites/postgresql_18` (official/high reputation, version-specific). A follow-up query against the resolved `/sqlite/sqlite` source mirror supplied FTS5 implementation details; its Context7 reputation is Low, so local/emulated confirmation is required before acceptance. An attempted direct official SQLite fetch with Python failed local certificate validation; TLS verification was not disabled.

References: [SQLite FTS5](https://www.sqlite.org/fts5.html), [SQLite tokenizer source](https://github.com/sqlite/sqlite/blob/master/ext/fts5/fts5_tokenize.c), [SQLite expression source](https://github.com/sqlite/sqlite/blob/master/ext/fts5/fts5_expr.c), [PostgreSQL parsers](https://www.postgresql.org/docs/18/textsearch-parsers.html), [dictionaries](https://www.postgresql.org/docs/18/textsearch-dictionaries.html), [controls](https://www.postgresql.org/docs/18/textsearch-controls.html). Documentation is design evidence, not runtime proof. Approved B2 resolved `/drizzle-team/drizzle-orm-docs` and verified generated migrations. B4 queried `/websites/postgresql_18` for materialized/recursive CTEs, LATERAL and GIN, and `/llmstxt/developers_cloudflare_d1_llms-full_txt` for quota failure and row metadata. SQLite materialized-CTE queries returned no relevant matches; native workerd supplies focused runtime evidence. Exact provider error spellings, FTS billing and cancellation remain documentation gaps. No HTML/CSS/client JavaScript is changed, so modern-web-guidance does not apply.

The shared [semantic corpus](../tests/fixtures/search-query-contract.ts) executes 08.V1/V2 quoting, exclusions, Unicode, missing-principal, nonexistent values, injection, unsupported syntax and complexity cases. Both stores pass the selected native suites; B3/B4 add stale authorization, representative query plans, out-of-order/rebuild and local tier evidence. Exact commands, failures and the requirement-by-requirement scope audit are in [search acceptance](plan/evidence/08-search-validation.md). Module 08 remains In progress: dispatch/queue integration and hosted tier evidence remain open, and all acceptance gates are unchanged.
