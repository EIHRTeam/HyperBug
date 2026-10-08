# ADR 0013: Bounded search contract and derived index

Status: Proposed; user approval is required before B2 implementation by HANDOFF-08.
Date: 2026-10-09.

## Context

Module 08 must provide shared search semantics on D1 and PostgreSQL while preserving current authorization, the existing plain-text projection, keyset pagination and strict resource bounds. PERFORMANCE §§16–19 and 76 require an explicit decision for search/pagination/denormalization. Native FTS5 and PostgreSQL query languages and ranking are not interchangeable public contracts.

## Proposed decision

Adopt [SEARCH-SPEC](../SEARCH-SPEC.md): independently versioned AST v1 with at most four OR branches and sixteen predicates, project-scoped search and filter-suggestion routes with stricter page/window budgets, and immutable creation-time/ID ordering. Reuse the existing cursor envelope rules with a resolved-query fingerprint and traversal budget; preserve ordinary list cursors. Expose only the seven MVP filters. Do not publish raw FTS syntax or native relevance scores.

Index the existing title/plain-text projection as derived data. SQLite unicode61 with diacritics retained and PostgreSQL simple configuration avoid stemming; documented native punctuation/Unicode differences require runtime corpus evidence. Current canonical authorization/moderation/revision always fences index membership, including suggestions and any internal counts. Unfinished or unavailable search produces a bounded explicit error; direct Issue access remains canonical.

## Consequences and verification

Search can lag canonical writes but cannot grant authorization or leak edited/moderated content through old text. UUID filter values are stable across renames but require a suggestion/selection flow. Creation ordering supports stable bounded traversal; native relevance ordering is deferred. Complexity/window values are design ceilings and do not prove execution/CPU/row budgets.

B2 must verify parameterized compilers, parser fixtures and keyset hydration on both stores. B3 must verify stale-index authorization, bounded lifecycle and representative query plans/counts/rows/latency. B4 must verify out-of-order revisions and local tier/reindex bounds. Module 09 owns dispatch/queue/retry acceptance; 13.G6 owns actual Free-plan evidence. No existing normative baseline or gate is relaxed.
