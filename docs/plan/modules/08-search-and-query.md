# 08 — Structured search, filters, and query performance

Phase: MVP backend  
Prerequisites: 07 complete; event contracts from 02, async dispatch completed in 09.  
Progress: [Session log and current status](../progress/08-search-and-query.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Provide one bounded search language and AST with separate optimized D1 and PostgreSQL compilers.

## Ordered checklist

### Step 08.1 — Define public query semantics

- [ ] **08.1a** Write `docs/SEARCH-SPEC.md` for text terms, quoting/escaping, negation, filters, sorting, errors, and an independently versioned structured AST.
- [ ] **08.1b** Support MVP filters for state, label (including exclusion), assignee, milestone, type, author, and project; resolve `me` from the authenticated principal.
- [ ] **08.1c** Define explicit bounds for text length, depth, predicates, OR branches, negations, label count, sort fields, FTS expression size, and result window.
- [ ] **08.1d** Decide and document tokenization, language support, case/diacritic behavior, ranking, and pagination semantics. Require shared product behavior while identifying ranking differences that cannot be identical.
- [ ] **08.1e** Define invalid syntax/unsupported filters as safe structured errors rather than silently changing query meaning.

### Step 08.2 — Implement database compilers and index lifecycle

- [ ] **08.2a** Implement a parser/validator and parameterized compiler for D1 FTS5 plus relational predicates.
- [ ] **08.2b** Implement the same AST for PostgreSQL tsvector/tsquery with GIN and appropriate relational indexes.
- [ ] **08.2c** Apply project/object authorization and moderation rules to current canonical records, including suggestions, counts, and stale-index results.
- [ ] **08.2d** Implement stable keyset pagination with sort tie-breakers, strict result limits, and batched hydration.
- [ ] **08.2e** Implement version-aware search update handlers that ignore stale events and handle deletions/redactions; connect dispatch in 09.
- [ ] **08.2f** Define acceptable index delay, retry, reconciliation, and bounded rebuild behavior. Provide a safe temporary initial indexing path for integration tests before dispatch is wired.
- [ ] **08.2g** Define timeout/degraded behavior that leaves direct Issue access usable and never expands authorization.

## Verification and acceptance

- [ ] **08.V1** Run one parser/semantic fixture suite on both backends, covering quoting, negation, Unicode, missing principals, empty results, unsupported operators, and SQL-injection inputs.
- [ ] **08.V2** Fuzz bounded parsing and reject complexity limits before expensive database work.
- [ ] **08.V3** Verify hidden/deleted/unauthorized data is absent from results and counts even with a deliberately stale index.
- [ ] **08.V4** Record query plans, index usage, rows read, query counts, and latency with representative larger datasets; investigate full scans and N+1.
- [ ] **08.V5** Replay updates out of order and rebuild an index from canonical data; complete queue/retry verification in module 09.

## Source coverage

PRODUCT §§20–21; TECH-STACK §24; SECURITY §§64–66, 141, 153; PERFORMANCE §§8–19, 63–66.

