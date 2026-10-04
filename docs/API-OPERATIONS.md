# Resource inventory and permission matrix

This inventory describes operation families; the current implemented paths are recorded in [API-CONVENTIONS](API-CONVENTIONS.md). Owning modules supply server-side authorization, validation and bounds; audit portions follow the explicit [suspension](plan/AUDIT-SUSPENSION.md).

| Resource / operation family | Anonymous | User | Staff | Owner |
| --- | --- | --- | --- | --- |
| Project metadata, Issue/detail/list, comments, public timeline | Read visible public data | Same | Read project data with membership | 04/06 |
| Create Issue/comment, add/remove own reaction | Denied | Active account in allowed visible project | Active authorized project member | 06 |
| Edit/delete own Issue body/title or comment | Denied | Own content subject to project policy and moderation lock | Own content; moderation needs separate privilege | 06 |
| Issue state/reason/type/labels/milestone/assignees | Denied | Denied | Triage or higher; assignment targets must be project Staff | 06 |
| Moderate content or view hidden content/history | Denied | Denied; redacted history is not public | Maintainer or administrator | 06 |
| Configure labels/types/milestones | Denied | Denied | Maintainer or administrator | 06 |
| Configure project/forms/templates | Denied | Denied | Administrator for project settings; maintainer for content templates/forms | 06/07 |
| Read pinned/disabled form or template history | Denied | Denied | Maintainer or administrator under `content:history`; archived project reads allowed | 07 |
| Membership/role grants and project destructive operations | Denied | Denied | Administrator with required assurance/recent auth and audit | 04 |
| Account/session/identity recovery | Public protocol entry only | Own account through validated flow | Own Staff identity through validated flow | 04 |
| Upload intent/finalize, attachment access | Public read only if explicitly safe | Active authorized content author; recheck on finalize | Active authorized member; same Core upload policy | 07 |
| Structured search/filter suggestions | Visible public records only | Currently authorized records only | Project-scoped currently authorized records | 08 |
| Audit list/detail | Denied | Denied | Authorized administrator; bounded, redacted | 03/04 |
| Plugin install/config/enable and secret operations | Denied | Denied | Administrator with assurance and audit; no secret echo | 05 |
| Outbox delivery and cleanup | No public endpoint | No public endpoint | Internal service capability only | 09 |
| API specification/client | Public safe contract | Public safe contract | Public safe contract | 10 |
| Relations/hierarchy/saved views | Feature-specific read policy | Personal views; no Staff triage privilege | Explicit scoped policy accepted before exposure | 14 |
| Subscriptions/notifications/jobs/export | Denied unless explicit public capability | Own authorized subscriptions/jobs | Scoped bulk/admin permission with reauthorization | 15 |
| Provider plugins/webhooks/integration callbacks | Signature/protocol entry only | Explicit feature capability | Explicit scoped feature permission | 16 |

Roles are cumulative for the operations above: administrator includes maintainer and triage; maintainer includes triage. Membership never converts a User principal into Staff. Authentication provider claims do not bypass local project grants. Deployment-wide bootstrap administrators are a distinct module 04 policy, not inferred from matching email or the first public signup.

Private projects are invisible to anonymous/nonmembers. Initial private project access requires an active Staff membership; User access is not inferred. Archived projects are read-only. A project's public visibility does not make its audit, identity, upload-intent internals, plugin configuration, private metadata or moderation history public.

A visible target is necessary but not sufficient to mutate it. Every write must bind the authenticated actor, explicit operation and project/object; current suspension/revocation and assurance rules apply. Database project predicates and foreign keys are integrity measures, not the authorization layer.

Events and projection metadata must be safe for their audience: a moderation event can say content was removed without embedding the removed text. Raw history is staff-restricted. Initial taxonomy, attachment, form and assignee references cannot cross projects. Module 14 owns any future cross-project relation policy, including checks on both endpoints and hiding inaccessible targets.

## Upload-intent operations

The optional backend storage configuration arms `PUT/GET /api/v1/projects/:projectId/uploads/:uploadId`, `POST .../capability` and `POST .../finalize`. Uploads are principal-owned even when their intended content is moderated by Staff. Private projects require current Staff membership; existing Issue/comment targets require the current author or maintainer/administrator permission, and comment drafts require a visible existing parent or moderation permission. Deleted targets are denied. Upload writes use authoritative principal/project `attachment-upload` admission; initial limits are 120/2400 per hour. Runtime database guards recheck permission inside reservation/state/accounting mutations. Multipart endpoints add create/resume/catalog reads, revision-conditional part receipts, bounded part capabilities, provider completion and abort. Provider IDs and owned keys come only from persistence, never request bodies. Part capabilities reauthorize after signing; trusted fenced provider bookkeeping preserves cleanup identity after permission loss. Abort retains quota until physical cleanup.

Finalization returns 202 `awaiting-processing`; no dispatcher is installed while Module 09 is held. Manual background processing can verify immutable bytes and return 200 replay as quarantined, but creates no attachment link, scan result or download permission. See [lifecycle contract](ATTACHMENT-LIFECYCLE.md) for exact states, quota/transaction rules, DTOs and remaining work.

Scanner/result release is an independent trusted background hook. It reauthorizes before claim/result/release and preserves used quota on all scan outcomes. Result commit and release are separate transactions, so permission loss or a crash can retain clean-but-quarantined state. No scanner/release HTTP endpoint, actual configured scanner or held Module 09 dispatch is supplied by this slice.

## Isolated media and Node TLS

Set the optional `HYPERBUG_MEDIA_ORIGIN` to the exact HTTPS media origin after choosing a hostname distinct from browser/auth/client origins. Both roots supply the existing attachment/read stores and blob adapter; no separate public bucket or reusable download capability is required. The selected media hostname serves only authorized `GET/HEAD /attachments/:attachmentId` and narrow OPTIONS, with forced download/no-store/nosniff. See [delivery contract](ATTACHMENT-LIFECYCLE.md#isolated-authorized-media-2026-10-04).

Node uses optional `HYPERBUG_TLS_FILE`, an absolute private POSIX mount owned by the process user with mode 0400 or 0600. Its closed JSON object contains exactly `cert` (PEM certificate chain) and `key` (unencrypted PEM private key); both are strings, not file paths. The existing no-follow bounded reader permits at most 16 KiB of complete configuration, and OpenSSL validates certificate/key loading before startup. Invalid/extra fields, malformed PEM, symlinks and broad permissions fail with a fixed error. Certificates/private keys are never printed. TLS is HTTP/1 with a TLS 1.2 minimum; `HOST` is passed as the actual srvx `hostname`. Restart with a replaced valid mount to rotate the certificate; hot reload is not implemented. A non-local media origin without TLS refuses Node startup.

Preserve the selected media Host and HTTPS connection through the final Node hop. TLS termination followed by plain HTTP is insufficient for this configuration: `Forwarded` and `X-Forwarded-*` are untrusted and do not select an HTTPS origin. Use direct Node TLS or a proxy that reconnects using TLS and preserves Host. Scheme/port aliases on the media hostname fail closed, including attempts to reach auth routes. The private media surface uses access-token Authorization, never ambient cookies. Ordinary API requests still carry no file buffers.

Local HTTPS acceptance uses an ephemeral self-signed certificate trusted explicitly by the test client; TLS validation remains enabled and the same request without its CA is rejected. Test fixtures require an installed OpenSSL CLI with `req -x509 -addext` support (verified locally with OpenSSL 3.6.4). No certificate, public origin, proxy, storage CORS or deployment is configured by these tests.
