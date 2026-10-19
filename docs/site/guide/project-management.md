# Triage and manage a project

[Documentation home](../index.md)

**For:** Triage staff, maintainers, and administrators.  
**Goal:** Organize feedback within your assigned permissions.

## Check your role

Open the project using its ID. Staff see **Manage project**; the server still checks each action. Triage can organize issues and close/reopen them. Maintainers also manage taxonomy, forms/templates and moderation/history. Administrators manage settings, Staff membership and project audit access. Sensitive administration requires recent verified passkey authentication; password-only login is insufficient. See [accounts](accounts.md).

## Triage incoming feedback

Open an issue and expand **Triage issue**. Available labels, types and milestones display their IDs. Set label/Staff-assignee IDs as comma-separated lists, or set one type/milestone ID. Empty values clear the selection. Only existing eligible Staff principals can be assigned. Confirm closing with the appropriate reason; confirm reopening separately. The timeline records past actions while the issue header shows current state.

Edits use the revision loaded when the form opened. After another change or a conflict, choose **Discard triage edits and reload latest values**, then review and submit again. This deliberately discards unsaved triage values.

## Configure a project

On **Manage project**, expand the relevant section. Maintainers can create, edit or delete labels/types/milestones, including label colors, type description/icon/color/order, and milestone descriptions/due dates. Forms accept the supported GitHub YAML subset; replacements create immutable versions. Templates contain Markdown. Participants can request server-derived previews when submitting feedback. A stale form requires reloading and reviewing the current definition.

Administrators can confirm project-name/visibility changes or archive the project. After a settings conflict, choose **Discard draft settings and reload latest values** before retrying. Archiving and visibility changes affect other participants; review the confirmation carefully.

## Manage members and moderate content

Administrators can grant a project role to an existing Staff principal ID or remove membership. Public User identities cannot receive Staff privileges. Recent authentication is required where policy specifies it.

Comment actions offer restricted edit history to Maintainers and confirmed moderation state changes. Hidden/redacted/deleted states replace ordinary content. Your own edits preserve their original revision and offer explicit discard/reload recovery after a conflict. Do not assume historical content is public.

Administrators can choose **Browse project audit trail**. Its bounded pages expose action/result/time and identifiers; private audit metadata and request IDs are omitted. This view does not edit or delete audit records.

## Manage trusted plugins

From **Account → Instance plugins**, an instance Administrator with recent passkey authentication can load settings and enable/disable registered plugins. Public values use JSON scalars. Secret fields are write-only: reads show presence, and successful saves clear the input. Load settings again to refresh the redacted display.

Native plugin code is trusted with application privileges; declared permissions are not a sandbox. The page displays trust/CSP requirements. Enabling a backend plugin does not load remote JavaScript or rewrite the frontend CSP. Disabled plugins do not provide their optional capabilities. Installation/removal and deployment changes use the operator workflow; this screen does not install arbitrary code.

## Verification scope

Local browser journeys, upload/failure checks, automated accessibility and the reported manual accessibility matrix pass across the backend profiles at their recorded scopes. Hosted provider/backend acceptance and release gates remain separate; capability explanations must match the running instance.

## Source references

[Permissions](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-OPERATIONS.md); [staff workflows](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/12-web-product-workflows.md).
