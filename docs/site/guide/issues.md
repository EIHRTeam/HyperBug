# Find, report, and discuss issues

[Documentation home](../index.md)

The product workflows pass local browser verification across Node/PostgreSQL and both Workers tiers. Hosted backend acceptance and release readiness remain separate gates.

## Find feedback

Open the project link shared by its team, or enter its complete project ID on Overview. The instance checks access to private projects. Search and page state are in the URL, so links can be shared and browser back/forward restores them. Only newest-created sorting is supported.

Search accepts words, quoted phrases and filters such as `state:open`, `label:UUID`, `type:UUID`, `milestone:UUID`, `author:me` and `assignee:me`. Replace UUID with a real identifier; “me” requires sign-in. Labels, types and milestones are listed under the project summaries. Search is limited to 512 characters and a bounded result window. Narrow the query when the window is full. Minimum instances search titles only; Standard searches titles and bodies. Comments are not searched.

## Submit an issue

Sign in, choose **New issue**, then select a Markdown template or an Issue Form. Provide a clear title and complete required fields. Forms support text, multiline text, dropdowns, checkboxes and upload fields. Required checkbox choices must all be selected. **Preview current content** asks the instance to render the current draft without publishing it; preview shares the comment request budget.

Drafts remain only in the current page’s memory. Navigation, reload, sign-out, expiry or permission changes clear them. Copy anything you need to preserve before leaving the page, taking care with private information. If a form version changes, load the current form and review every answer. The app does not remap old answers automatically.

If the result of a submission is uncertain, retry the unchanged submission. Its receipt prevents a duplicate after a committed request whose reply was lost. Changing the payload starts a different submission.

## Attach files and read content

Uploads require an operator-configured direct-upload destination. Choose a file, upload it, and use progress/cancel/retry controls as needed. Files can require processing and scanning before release; uploaded bytes alone do not mean the file is safe or usable. Check processing status before submitting required upload answers. Expired uploads need a fresh reservation; quota and file-type limits still apply.

Content is rendered from the instance’s centralized safe representation. Raw HTML, scripts and unsafe links are removed by the server. External image links stay inert until you choose to reveal/open them; opening contacts that external host. Released attachments are fetched through a separately configured media origin with current access checks. Dangerous formats download as files, never as active content in the app. Only released PNG, JPEG, GIF or WebP images up to 8 MiB are eligible for explicit image preview.

## Discuss and track progress

Issue links include the stable issue identifier and its project-local number. Comments and events share a paginated timeline; only one page of 20 entries is rendered at a time. Use timeline page links and comment permalinks to revisit older discussion. Browser back/forward preserves page state.

Signed-in participants can comment, add/remove their reactions and edit/delete their own comments where policy permits. Maintainers can inspect original edit history and moderate content. Hidden, redacted and deleted content has an explained unavailable state. Closed issues retain their history; archived projects are read-only.

## Recover from errors

Network failure preserves the in-memory draft while you stay on the page. A conflict means the resource changed: load the latest version, compare your work and retry deliberately. Authentication or permission loss clears private caches and drafts; sign in again with the appropriate identity. Sensitive staff actions require a recent verified passkey sign-in; repeating password sign-in alone is insufficient.

See [Accounts and access](accounts.md), [Project management](project-management.md), and the [content policy](https://github.com/EIHRTeam/HyperBug/blob/main/docs/MARKDOWN-POLICY.md).
