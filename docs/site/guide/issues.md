# Find, report, and discuss issues

[Documentation home](../index.md)

> Status: Backend content policy partially verified locally; product steps and examples remain pending.

**For:** Visitors and signed-in feedback participants.  
**Goal:** Find existing feedback, submit a useful report, and follow its discussion.

## Find an existing issue

To write: Cover project scope, search, filters, sorting, pagination, shareable links, and invalid searches; add syntax only after module 08 acceptance.

## Submit feedback

To write: Outline template selection, required form fields, a clear title, reproduction details, expected and actual results, preview, and submission confirmation.

The backend now accepts bounded GitHub Issue Forms YAML, stores immutable form/template versions and provides staff management APIs. Active forms generate deterministic Markdown and retain their structured answers when creating an issue. A stale draft must reload its definition; a committed retry with the same idempotency key and payload returns its original issue even if the form later changes. Templates and enabled forms follow project visibility; pinned or disabled history requires a maintainer. Form upload answers require a matching draft identity and files owned by the reporter that have been finalized, released and bound to a current clean scan. Linking commits atomically with the issue, and each upload can be consumed once. Actual scanner acceptance remains pending. Product controls and browser walkthroughs remain pending. See the [format and API specification](https://github.com/EIHRTeam/HyperBug/blob/main/docs/ISSUE-FORMS.md).

## Write content and add attachments

Verified backend policy (Module 07; product UI remains pending): content supports headings, emphasis, code, lists, task checkboxes, tables and links. The server sanitizes raw HTML and removes scripts, event handlers, SVG/MathML and unsafe URLs. Bodies allow at most 32,768 Unicode code points subject to API byte limits; deeply nested or unusually complex formatting is rejected. External images are represented as inert references for a future click-to-load control. Attachment references do not grant download access. Optional backend upload intents now reserve quota and issue short-lived direct PUT capabilities below the configured multipart threshold. Larger reservations use multipart create/resume, part upload capabilities, receipts and completion/abort. Abort retains quota until physical cleanup; an uncertain creation can require operator reconciliation. Manual background verification preserves immutable final bytes, but files remain unscanned and quarantined; automatic processing and authorized download delivery remain pending. Form attachment linking is implemented behind current clean-scan release checks. Scanner hooks now enforce complete immutable-byte verification, quarantine and recorded results before release; no actual scanner is configured or accepted, and synthetic tests do not prove malware detection. Issue/comment lists carry stored plain-text previews, while authorized details and visible timeline comments include a safe tree. No product browser walkthrough or deployed acceptance is claimed.

## Discuss and track progress

To write: Cover comments, reactions, permitted edits, stable links, timeline entries, moderation states, and closed or archived issues.

## Recover from an interrupted action

To write: Cover expired sign-in, stale form versions, conflicting edits, failed uploads, and uncertain submission outcomes without encouraging duplicate reports.

## Completion requirements

Browser walkthroughs cover successful and failed submissions, accessible forms, discussion, and uploads against both accepted backend profiles.

## Source references

[Workflow acceptance](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/12-web-product-workflows.md); [content policy](https://github.com/EIHRTeam/HyperBug/blob/main/docs/MARKDOWN-POLICY.md); [search plan](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/08-search-and-query.md).

The backend can now serve released attachments from an explicitly configured, separate HTTPS media origin. Public downloads follow the visibility of their issue or comment; private downloads require current authorized access, and a link alone grants none. Files download with safe filenames and no shared caching, including HTML, SVG and scripts. Local checks cover both backend profiles; production origins, browser steps and actual scanner acceptance remain pending.
