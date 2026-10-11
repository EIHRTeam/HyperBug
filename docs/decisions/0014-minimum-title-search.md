# ADR 0014: Minimum title-only search capacity

Date: 2026-10-11.

Status: User-authorized direction after repeated optimization and native CPU failures; limited native dispatch fit observed; full profile acceptance remains pending.

Owners: 08, 09; acceptance dependencies 10, 13.

Refines: [ADR 0013](0013-bounded-search-contract.md), [FREE-TIER-PROFILE](../FREE-TIER-PROFILE.md).

## Decision

Reduce `cloudflare-minimum` text search to Issue titles. Cloudflare Standard and Node/PostgreSQL retain title and canonical plain-text body search. Structured filters, normalization, phrases, exclusions, ordering, authorization, revision fences, quotas and content storage remain unchanged. Comments were never indexed. Canonical Issue/comment length limits remain unchanged: shortening raw content would not address the tiny-body cold invocation failure, and the canonical body projection is already bounded at 4,096 code points.

Native retries repeatedly exceeded the documented 10 ms Free CPU ceiling after initialization, metering, provider batching and cursor optimizations. Local maximum-content title-only profiles reduce transferred/tokenized content and sampled cold costs; they are diagnostic evidence, not a native speedup or Free acceptance claim. See [Module 09 evidence](../plan/evidence/09-async-validation.md#maximum-content-title-only-prototype--2026-10-11). The user permits this capacity reduction and a higher project target after repeated failures. This decision applies the search reduction; the project target remains 10 ms. A fresh maximum-content native phase-0 sample meets 10 ms without measured margin; quota refusal/recovery take 2/4 ms. The [cleaned observation receipt](../plan/evidence/09-hosted-native-declarative-retry-receipt.json) proves this limited scope, not complete composition or release acceptance. A future higher internal target cannot change Cloudflare's physical limit or establish 13.G6 acceptance.

## Index and cursor transition

Reuse the derived `search_documents` table without a schema migration. Minimum stores an empty body and `title-v1:` followed by the canonical body projection version as its derived projection identity. Canonical version/content are untouched. Source SQL returns only the title, revision, visibility and projection witness plus an empty/null body marker; it does not transfer body content. Retain missing-projection rejection and current canonical projection/revision/visibility checks at commit. Both adapters implement these portable tier semantics; Node still refuses Minimum configuration.

Readiness and result membership require the selected mode's projection identity, so switching modes produces `SEARCH_INDEX_INCOMPLETE` until bounded reconciliation completes. Minimum text compilation addresses only the title even if old body postings still exist. Standard requires its full-text identity. A rolling mixed-mode deployment can repeatedly invalidate readiness; stop the old dispatcher before switching and complete bounded rebuilding before restoring search traffic. No read performs a rebuild or fallback scan.

Retire Minimum cursor policy 1 with `CURSOR_STALE`; new Minimum cursors use policy 2. Standard keeps policy 1 and its existing fingerprint. Tier/query mismatches remain `INVALID_CURSOR`. A cursor grants no access.

For upgrade or downgrade, use the existing sensitive administrator `reindexSearch` service with the selected tier, one page at a time (Minimum at most ten documents, Standard twenty-five), following its returned cursor. There is no new endpoint. Preserve canonical rows, outbox/timeline/audit history and quota reservations. Current pending events also rebuild their affected document through ordinary delivery. Reconciliation is required for already-acknowledged documents; quota exhaustion leaves search explicitly unavailable and the task resumable. Restore the prior mode and rebuild if rolling back.

## Disclosure and verification

The instance document adds `search.textScope`: `title` on Minimum and `title-and-body` on Standard. FREE-05 discloses title-only search with existing capacity ceilings; `minimum-v2` acknowledgement retains its broader capacity-degradation meaning. Reader documentation is synchronized in English and Simplified Chinese.

Focused review must cover mode-switch readiness, partial and bidirectional rebuilds, title/body distinction, Unicode/phrase/exclusion behavior, retired cursors, canonical-data preservation, stale visibility/permissions and current-state fences. Native CPU and recovery measurements remain separate from local semantic checks. Suspended audits and backend/release gates remain unchanged.


Later full-composition HTTP measurements execute the actual Minimum scheduled method/configuration: fault9ms/resume7ms proves hosted D1 interruption/redeployment and pending-event survival;maximum dispatch14ms initially fails10ms. Replacing only the single fenced D1 index upsert's one-element batch with metered all/RETURNING yields a fresh max dispatch9ms. Multiple-document transactions,current-state/abort/metadata checks,canonical limits and every numeric quota remain. One sample per variant and worse/noisy local medians do not establish causality or sustained margin. [R12](../plan/evidence/09-hosted-composed-http-recovery-receipt.json)/[R13](../plan/evidence/09-hosted-single-write-dispatch-receipt.json) independently verify cleanup. Native Cron/full-profile acceptance staysopen;target10ms and title-only capacity remain.
