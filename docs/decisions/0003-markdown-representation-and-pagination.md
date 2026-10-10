# ADR 0003: Markdown representation, transport and pagination

Status: Accepted direction; implementation, measured cost evidence and both-profile acceptance belong to module 07.
Date: 2026-09-18.

## Context

The baseline already fixes raw Markdown as canonical storage and forbids storing only rendered HTML ([PRODUCT](../../docs/initial-architecture/PRODUCT.md%20—%20产品定位、规划与边界.md) §17), defines an ordered pipeline ending in a safe element tree ([SECURITY](../../docs/initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §54, [ARCHITECTURE](../../docs/initial-architecture/ARCHITECTURE.md%20—%20技术架构与工程基线.md) §39), treats a sanitized rendered representation as an optional cache keyed by policy version ([SECURITY](../../docs/initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §55), and requires an independent static SPA without an SSR runtime ([TECH-STACK](../../docs/initial-architecture/TECH-STACK.md) §31).

Within that baseline, three representation/transport options were considered: deriving a sanitized representation per request; persisting the derived sanitized HTML or tree alongside the Markdown; and transmitting sanitized HTML as the only body the client receives. The third option would make the sanitizer's output a long-lived public contract, leaves the client with no element-level policy hooks for external images and attachment URLs, and pushes HTML strings into DOM sinks whose safety the browser cannot verify ([SECURITY](../../docs/initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §61). The second would add a denormalized artifact that must be invalidated and re-derived whenever the policy changes ([PERFORMANCE](../../docs/initial-architecture/PERFORMANCE.md) §§20–21, 76). This decision also records how body derivation interacts with collection pagination, which [PERFORMANCE](../../docs/initial-architecture/PERFORMANCE.md) §76 lists as ADR-worthy.

## Decision

Store raw Markdown only. Derive all rendered representations at request time and never persist them:

- `tree` (sanitized element tree) is the representation transported to SPA content surfaces. The public contract carries the element tree, not an HTML string.
- `html` (sanitized HTML) is generated only for non-browser consumers (email, unfurl/OpenGraph, webhook, export) and is never transported to the SPA or treated as a stable public field.
- `text` (plain-text projection) is the single persisted derivative because it has independent consumers (search index, notification body, list preview, moderation view). It is computed during the write that changes the body, and its version is recorded with the row.

Accepted consequences of this choice: derivation cost moves to the read path and must be bounded (write-time nesting/pathology rejection, the existing body-size limit, the endpoint deadline, and a stable per-request derivation budget measured on both runtimes before acceptance); output must be byte-deterministic for a given body, kind and policy version so ETags remain correct; a public representation may be conditionally cached while authenticated or user-specific responses are not, and validators include the content-policy version; and a policy upgrade requires no re-render of stored Markdown, while the `text` projection is upgraded by a bounded backfill owned by module 07 rather than on the read path.

Pagination keeps the existing cursor semantics ([DATA-MODEL](../../docs/DATA-MODEL.md), [API-CONVENTIONS](../../docs/API-CONVENTIONS.md)): default 40, cap 100, opaque cursor, per-page reauthorization. List rows exclude full body representations and carry at most the stored plain-text preview; timeline entries paginate under the same contract, so per-request derivation is bounded by the page limit rather than by discussion length; cursors never depend on policy version or rendering, so a policy change does not invalidate stored cursors.

## Consequences

Derived rendering disappears from persistent storage, so no invalidation sweep and no derived-content staleness exist; the cost is paid as bounded per-request work. The SPA keeps element-level control (external-image click-to-load, attachment URL refresh, headings, code blocks) and does not need an HTML sink. The policy module owns a small deterministic `text` projection with its own version and bounded backfill. Per-request derivation cost becomes a measured acceptance item, not an assumption; if measurement shows the budget cannot be met, the fallback is the bounded derived cache already permitted by [SECURITY](../../docs/initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §55, whose introduction would return here as an amendment.

This decision relaxes nothing: [SECURITY](../../docs/initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §§53–66 Sanitization, §61 rendering sinks, §139 notification encoding and the [PERFORMANCE](../../docs/initial-architecture/PERFORMANCE.md) §76 cache/denormalization review rules all continue to apply unchanged. It creates no new cache layer, no read replica assumption and no large persistent frontend dependency. The policy specification lives in [MARKDOWN-POLICY](../../docs/MARKDOWN-POLICY.md); the module-07 checklist owns implementation and evidence.

## Verification

Module 07 must show, on both profiles: the malicious Markdown corpus (07.V1) with bounded processing; byte-identical repeat derivation for equal input (07.V6); no derived artifact persisted, including no rendered representation in stored rows, outbox payloads or logs (07.V6); derivation cost measured for the maximum accepted body and for full pages, with recorded thresholds (07.V7); and unchanged cursor traversal across a policy version change (07.V7). Until those pass, the direction is accepted but unproven, and no public content endpoint exists.
