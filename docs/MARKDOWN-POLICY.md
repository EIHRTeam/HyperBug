# HyperBug Markdown content policy

Status: Module 07 implementation in progress. `hyperbug-content-1` is implemented in `packages/security/src/markdown` and verified with the adversarial corpus on Node and local workerd. Endpoint transport/projection integration and broader acceptance are tracked in the Module 07 checklist. [ADR 0003](decisions/0003-markdown-representation-and-pagination.md) remains authoritative.

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

## Remaining acceptance

The implementation and local evidence below cover the initial policy. Module 07 still owns complete forms/attachment integration, real-provider storage acceptance, and runtime validation of an actual upgraded policy bundle. No SPA, image proxy, shared-cache enablement or Module 09 scheduling is included.

## References

- [PRODUCT §§17–22](initial-architecture/PRODUCT.md%20—%20产品定位、规划与边界.md)
- [SECURITY §§53–66, 139, 152](initial-architecture/SECURITY.md%20—%20安全架构与基线规范.md)
- [ARCHITECTURE §39](initial-architecture/ARCHITECTURE.md%20—%20技术架构与工程基线.md)
- [TECH-STACK §§31, 51](initial-architecture/TECH-STACK.md)
- [PERFORMANCE §§5, 19–21, 29–30, 73, 76](initial-architecture/PERFORMANCE.md)
- [Data model](DATA-MODEL.md), [API conventions](API-CONVENTIONS.md), [API operations](API-OPERATIONS.md)
- [ADR 0003: Markdown representation, transport and pagination](decisions/0003-markdown-representation-and-pagination.md)


## Version 1 allowlist and bounds

`hyperbug-content-1` pins unified 11.0.5, remark-parse 11.0.0, remark-gfm 4.0.1, remark-rehype 11.1.2, rehype-raw 7.0.0, rehype-sanitize 6.0.0 and hast-util-to-html 9.0.5. Raw HTML expansion precedes the final explicit sanitizer schema. Default library schemas are never spread into Core policy. No plugins run after sanitization; the final conversion only narrows attributes/URLs and replaces images with inert references.

Allowed tags: `p`, `br`, `hr`, `h1`–`h6`, `blockquote`, `ul`, `ol`, `li`, `pre`, `code`, `strong`, `em`, `del`, `a`, `img`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, and disabled checkbox `input`. Unknown tags are unwrapped; `script`, `style`, `iframe`, `object`, `embed`, `svg`, `math`, `template`, `form`, `textarea`, `select`, and `button` lose their entire subtrees. Comments and doctypes are removed. No global attributes, IDs, names, styles, event attributes, arbitrary data attributes or namespaces survive.

| Element | Permitted properties |
| --- | --- |
| `a` | `href`, `title`; trusted `rel=nofollow ugc noreferrer noopener` added to links |
| `img` | `src`, `alt`, `title`, subsequently replaced by an inert image node |
| `code` | A single `language-` class suffix matching 1–32 ASCII letters/digits/underscore/hyphen |
| `input` | `type=checkbox`, `disabled=true`, optional `checked=true`; arbitrary inputs become disabled checkboxes |
| `ul`, `ol`, `li` | Exact GFM task-list classes; `ol.start` restricted to integers 1–1,000,000 |
| `th`, `td` | `align=left/right/center` |
| Other allowed elements | None |

Links accept absolute HTTP/HTTPS, a simple `mailto:` address without query, a single-leading-slash local path, or a safe fragment. Images accept only absolute HTTPS or `/attachments/<canonical UUID>`. Protocol-relative, credential-bearing, control/whitespace/backslash-containing and encoded-control/backslash URLs are rejected. Sanitization decodes HTML entities before the stricter URL check. No URL uses a request host or environment-derived base.

Source limits: 32,768 scalar code points, 131,072 UTF-8 bytes, no NUL or unpaired surrogate, 8,192 syntax characters, 2,048 HTML tags, bracket/block-quote/HTML nesting of at most 32 and at most 128 leading indentation characters. These conservative lexical checks apply even inside code examples; rejected content must be simplified. Before transforming the Markdown AST, after raw HTML expansion and after sanitization, trees are bounded to 8,192 nodes and depth 32. Synchronous parsers cannot be preempted by an asynchronous timer: these deterministic work limits and measured budgets are the processing-time defense. Endpoint cooperative deadlines remain additional protection, not a claim to interrupt synchronous parsing.

## Images, privacy and attachment references

The public tree contains an `image` node with `alt`, optional title, and either `{kind: external, url}` or `{kind: attachment, id}`; it contains no active `img.src`. The future SPA must show a keyboard-accessible click-to-load control, explain that loading contacts the external host, and use `referrerPolicy=no-referrer` after explicit activation. No browser renderer or SPA is implemented here. Core never fetches these images. Internal HTML consumers get a safe link in place of the image, also preventing automatic tracking requests.

Attachment IDs are presentation references, never permission grants. The attachment service must reauthorize resolution and supply short-lived isolated-origin delivery at use time. Signed capabilities are never embedded in the deterministic tree or persisted with Markdown. Attachment-like paths with query parameters fail this reference grammar.

## Projection and validator algorithm

`hyperbug-text-1` flattens sanitized textual content and image alternate text, collapses Unicode whitespace, trims, and truncates to 4,096 scalar code points; its preview is at most 280 scalar code points. This projection is computed only on body-changing writes or explicit bounded backfill. Parser, flattening, normalization or truncation changes require a projection-version change.

Representation validators encode resource identity, revision, representation kind and content-policy version. Resource identity prevents collisions among distinct revision-1 rows. Every output change (including parser upgrades) requires a content-policy version bump; changing policy does not alter cursor tuples. No rendered output is cached or persisted by this implementation.

Local wall-time measurements for maximum accepted plain/GFM/Unicode bodies and 100-item pages are recorded in [the measured fixture](plan/evidence/07-markdown-derivation.json). They are neither paid Workers CPU measurements nor deployment acceptance. Initial regression ceilings are 1,000 ms mean per body and 8,000 ms per 100-body page, leaving space below the existing 10-second endpoint deadline. These are generous regression ceilings for the observed fixture, not proof that every permitted construct has its worst-case cost measured.


## Persistence, backfill and recovery

D1 migration `0018_content_projection` and PostgreSQL migration `0017_content_projection` add nullable `body_text` and `body_text_version` to issues/comments. Body-changing repository writes produce text through the central policy and atomically commit it with the body/revision, receipt and existing events. Other mutations retain the text. Histories keep canonical Markdown, not derived renderings. Lists take at most 280 scalar code points from the stored projection; they never parse Markdown. Unprojected legacy rows expose a null preview/version rather than silently changing a read into a write or re-derivation.

The explicit `ContentProjectionStore.backfill` task takes a project ID, resource (`issues` or `comments`), optional ID cursor and a limit (default 20, maximum 100). It selects at most limit+1 rows ordered by ID, computes the central projection, and compare-and-sets each row at the observed revision if its projection version is still stale. Concurrent body writes win; replay skips rows already upgraded. A crash may leave a completed prefix on PostgreSQL; rerunning the page is safe. D1 commits each bounded page's updates as a batch. Neither adapter changes content revisions, canonical history or events. The caller persists the checkpoint only after the call succeeds, records rejected IDs without bodies, revisits conflicts/rejections, and starts another project-local sweep to capture rows skipped by concurrent writes. Invalid legacy bodies require explicit content repair through the authorized editing service; they are never assigned fabricated text. No scheduler is wired under the Module 09 hold.

This additive migration does not rewrite existing data or remove columns. Application rollback retains the nullable columns; forward recovery reruns bounded backfill. A projection algorithm/version upgrade changes the writer and explicit task version together, keeps reads on each row's recorded version, then repeats the bounded sweep. There is no read-path backfill.
