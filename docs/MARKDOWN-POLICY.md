# HyperBug Markdown content policy

Status: Phase 07 policy specification. Adopted as the project direction by [ADR 0003](decisions/0003-markdown-representation-and-pagination.md). The element/attribute/URL allowlist, the concrete `content-policy` version identifier and the pipeline implementation remain module 07 work; until 07.1 is implemented and verified, no public content endpoint exists.

## Canonical data and representations

Raw Markdown is the only canonical stored form of user content. The database does not store rendered HTML, sanitized element trees or any other derived rendering artifact, in whole or in part. This is the baseline rule in [PRODUCT](initial-architecture/PRODUCT.md%20—%20产品定位、规划与边界.md) §17, [SECURITY](initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §§54–55 and [DATA-MODEL](DATA-MODEL.md) (Issue invariants).

A request derives one of three representations from the stored Markdown:

| Kind | Consumer | Stored | Transported to clients |
| --- | --- | --- | --- |
| `tree` - sanitized element tree (`Safe HAST` / React nodes) | SPA content surfaces | No; regenerated per request | Yes |
| `html` - sanitized HTML string | Non-browser consumers: email, unfurl/OpenGraph, webhook, export | No; generated when that consumer needs it | No |
| `text` - plain-text projection | Search index, notification bodies, list preview, moderation view | Yes: computed at write time | Yes: list rows and previews |

Transporting `tree` rather than `html` keeps the client free of HTML sinks and keeps element-level display policy (external-image click-to-load, attachment URL refresh, headings, code blocks) in the renderer, while `html` stays an internal artifact that is never part of the public contract.

## Pipeline

The mandatory order is [SECURITY](initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §54:

```text
Raw Markdown
-> Markdown parser
-> GFM extensions
-> Raw HTML parse
-> Sanitization
-> Safe element tree
-> Render
```

Raw HTML parse always precedes sanitization; a sanitizer that runs before raw-HTML expansion is not acceptable. The allowlist is explicit (allowed elements, attributes, URL schemes), versioned, and centralized in `packages/security/markdown` ([SECURITY](initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §§56, 60). No feature, notification channel or plugin maintains a second allowlist. Both production profiles expose identical policy semantics ([TECH-STACK](initial-architecture/TECH-STACK.md) §51); an adapter may optimize execution but may not change the policy or its version.

## Derived-content bound

Rendering a body must be bounded independently of how many readers request it. Required constraints:

- Stored body size is bounded (currently 32,768 Unicode code points), and endpoint byte limits apply before expensive work ([SECURITY](initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §63).
- Write-time validation bounds Markdown nesting depth, repetition and pathological constructs. A write that would make later rendering abnormally expensive is rejected at the server boundary rather than paid by every reader.
- A single rendering operation must complete within the endpoint's cooperative deadline ([API-CONVENTIONS](API-CONVENTIONS.md): today a 10-second default) for the maximum accepted body.
- Per-request rendering work is proportional to the page size multiplied by the per-body bound, never to the size of the whole discussion (see Pagination and rendering cost).

Derived rendering never runs for content the requester may not see. Authorization and moderation state are evaluated before rendering, and a moderated or hidden body yields the tombstone response with no body or preview derived from it ([API-OPERATIONS](API-OPERATIONS.md)).

## Determinism

The same stored Markdown, kind and content-policy version must produce byte-identical output, independent of request, runtime, process or concurrency. The pipeline therefore injects no timestamps, request IDs, random identifiers, absolute URLs derived from the request host, or environment-dependent ordering.

Determinism is a correctness requirement for two mechanisms:

- Validators. An `ETag` for a body representation is derived from the item revision, the representation kind and the content-policy version - never from render time or a per-request value.
- Cursors. Cursor boundaries remain the immutable ordering tuple (`created_at`, `id`) defined in [DATA-MODEL](DATA-MODEL.md); rendering or policy changes never move a boundary.

A policy version identifies the parser/extension set, the allowlist and any post-processing that changes output. A change that alters rendered output for unchanged Markdown requires a policy version change ([SECURITY](initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md) §55). Upgrading derived `text` for existing rows is a bounded backfill owned by module 07, not a read-path side effect; until a row is backfilled it keeps serving its recorded projection version.

## Publish, cache and invalidation

Validators and caching follow the existing rules rather than introducing a new cache layer: public anonymous representations may use conditional requests and shared caches ([PERFORMANCE](initial-architecture/PERFORMANCE.md) §§20–21), authenticated or user-specific responses use an equivalent of `Cache-Control: no-store`, and cached public content is revalidated with the derivation-keyed `ETag` above. Including the policy version in the validator ensures a policy upgrade cannot be answered by a stale `304`.

Because nothing derived is persisted, a policy upgrade needs no re-render of stored content and no invalidation sweep for representations: the next request derives with the new version.

## Pagination and rendering cost

Collections use the bounded cursor pagination already defined in [API-CONVENTIONS](API-CONVENTIONS.md) and [DATA-MODEL](DATA-MODEL.md): a default page of 40 items, a hard cap of 100, opaque `after` cursors and no deep offset paging.

- List rows exclude full body representations. A row carries metadata and the stored plain-text preview; a `tree` body is returned only by an item or detail endpoint.
- Issue detail timelines use the same cursor contract, so per-request derivation stays bounded by the page limit instead of growing with the total number of comments.
- A client that needs many bodies pages for them explicitly; it does not request an unbounded body list.
- Cursor semantics are unchanged: a cursor is not an authorization capability, every page is reauthorized, and a rendering or policy change does not invalidate stored cursors.

## Open items owned by module 07

- The concrete allowlist and its initial `content-policy` version identifier (07.1a).
- The pipeline implementation and both-profile parity tests (07.1b–07.1c).
- External image handling, attachment URL presentation and their rendered markers (07.1d).
- The bounded `text` projection algorithm, its exact bounds and its backfill procedure (07.1g).
- Measured per-body and per-page derivation cost on both runtimes, recorded as evidence (07.1i).

## References

- [PRODUCT §§17–22](initial-architecture/PRODUCT.md%20—%20产品定位、规划与边界.md)
- [SECURITY §§53–66, 139, 152](initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md)
- [ARCHITECTURE §39](initial-architecture/ARCHITECTURE.md%20—%20技术架构与工程基线.md)
- [TECH-STACK §§31, 51](initial-architecture/TECH-STACK.md)
- [PERFORMANCE §§5, 19–21, 29–30, 73, 76](initial-architecture/PERFORMANCE.md)
- [Data model](DATA-MODEL.md), [API conventions](API-CONVENTIONS.md), [API operations](API-OPERATIONS.md)
- [ADR 0003: Markdown representation, transport and pagination](decisions/0003-markdown-representation-and-pagination.md)
