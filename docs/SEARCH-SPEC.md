# Bounded Issue search, version 1

Status: Approved by the user on 2026-10-09; B1/B2 committed; B3 lifecycle and HTTP implementation is under verification. Module 08 owns implementation; module 09 owns production dispatch and scheduling. This specification supplements the existing [API conventions](API-CONVENTIONS.md), [data model](DATA-MODEL.md) and [permission matrix](API-OPERATIONS.md); it changes none of their normative baselines.

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

Native parser differences are explicit: PostgreSQL recognizes compound words, URL/email/number token classes and overlapping hyphen components; unicode61 splits primarily by Unicode categories. Unicode versions and non-ASCII case handling can differ. The shared grammar/filter/authorization/cursor behavior is identical, while punctuation-heavy terms may produce differing text matches. B2/B3 must record real native behavior with common fixtures rather than assert byte-identical tokenization. No extension, custom dictionary or tokenizer dependency is introduced to hide those differences.

V1 exposes only `created_desc`, ordered by immutable `(created_at DESC, id DESC)`, with strict tuple comparisons. Relevance ordering and mutable timestamp sorts are not public sort modes. FTS5 BM25 and PostgreSQL `ts_rank` are different algorithms and score scales; neither affects pagination or appears in responses. No cross-store ranking parity is claimed.

Extend the existing v1 cursor envelope and its strict validation, not a second pagination scheme: bind resource, route project, normalized/resolved AST and sort fingerprint, tier/window policy, traversal count, and the last immutable tuple. Existing list cursors continue to work for their original operation. The current implementation's Issue cursor contains `state` rather than a general fingerprint; search adds the specified fingerprint as part of extending that envelope. Include the AST/bounds version and resolved `me` identity in fingerprint input; exclude formatting differences. Validate the cursor before expensive work. Project/query/sort/tier mismatch is `INVALID_CURSOR`; retired policy/version is `CURSOR_STALE`. A cursor is never an authorization capability. Each page uses current canonical authorization; inserts/deletions and mutable filters follow the existing live traversal rules, with no snapshot promise.

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

Readiness bounds the canonical project candidate set to 4,096 total Issues on Standard and 256 on Minimum, with one sentinel. Larger projects receive `SEARCH_BUDGET_EXHAUSTED`; results are never silently sampled. The bound counts hidden/deleted rows too. These are invocation candidate ceilings, distinct from the 200/50 result window. The shared route wraps store work in at most 1,000 ms (or the smaller configured read deadline). A timed-out D1 operation may still finish; no repair write is launched by a read. PostgreSQL's composition root additionally uses physical `statement_timeout: 1000`. Search failures do not affect direct canonical Issue access. Suggestions select at most the tier's maximum first-page matches, deduplicate current field values and return at most ten; they do not promise exhaustive taxonomy discovery. B4 implements version-aware update/delete/redaction handling: stale/replayed events cannot overwrite a newer derived revision or resurrect a deletion. Operator work is explicit, resumable, authorized and bounded; no startup sweep or loop-until-complete is introduced. Retry scheduling, leases, delivery and queue/retry acceptance remain module 09 work. Before dispatch exists, integration fixtures/operator tasks invoke the same handler against canonical data through the bounded initial indexing path. Missing runtime evidence leaves the corresponding acceptance items open.

## Research and acceptance status

Context7 resolve-then-query on 2026-10-09 selected `/websites/sqlite_docs` (official/high reputation, but only an FTS5 pointer) and `/websites/postgresql_18` (official/high reputation, version-specific). A follow-up query against the resolved `/sqlite/sqlite` source mirror supplied FTS5 implementation details; its Context7 reputation is Low, so local/emulated confirmation is required before acceptance. An attempted direct official SQLite fetch with Python failed local certificate validation; TLS verification was not disabled.

References: [SQLite FTS5](https://www.sqlite.org/fts5.html), [SQLite tokenizer source](https://github.com/sqlite/sqlite/blob/master/ext/fts5/fts5_tokenize.c), [SQLite expression source](https://github.com/sqlite/sqlite/blob/master/ext/fts5/fts5_expr.c), [PostgreSQL parsers](https://www.postgresql.org/docs/18/textsearch-parsers.html), [dictionaries](https://www.postgresql.org/docs/18/textsearch-dictionaries.html), [controls](https://www.postgresql.org/docs/18/textsearch-controls.html). Documentation is design evidence, not runtime proof. Drizzle migration lookup is deferred until the approved B2 migration batch. No HTML/CSS/client JavaScript is changed, so modern-web-guidance does not apply.

The shared [semantic corpus](../tests/fixtures/search-query-contract.ts) prepares 08.V1/V2 quoting, exclusions, Unicode, missing-principal, nonexistent values, injection, unsupported syntax and complexity cases. It is not executed against a parser or either store in B1. B2 must use that corpus on both stores; B3 adds stale authorization and representative query measurements; B4 adds out-of-order/rebuild/tier evidence. Module 08 remains In progress and all acceptance gates remain unchanged.
