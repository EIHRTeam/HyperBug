# Resource inventory and permission matrix

This inventory allocates future endpoint families; it does not register routes. Only health endpoints are implemented by module 01. Later modules must implement server-side authorization, validation, bounds and required audit before enabling an operation.

| Resource / operation family | Anonymous | User | Staff | Owner |
| --- | --- | --- | --- | --- |
| Project metadata, Issue/detail/list, comments, public timeline | Read visible public data | Same | Read project data with membership | 04/06 |
| Create Issue/comment, add/remove own reaction | Denied | Active account in allowed visible project | Active authorized project member | 06 |
| Edit/delete own Issue body/title or comment | Denied | Own content subject to project policy and moderation lock | Own content; moderation needs separate privilege | 06 |
| Issue state/reason/type/labels/milestone/assignees | Denied | Denied | Triage or higher; assignment targets must be project Staff | 06 |
| Moderate content or view hidden content/history | Denied | Denied; redacted history is not public | Maintainer or administrator | 06 |
| Configure labels/types/milestones | Denied | Denied | Maintainer or administrator | 06 |
| Configure project/forms/templates | Denied | Denied | Administrator for project settings; maintainer for content templates/forms | 06/07 |
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
