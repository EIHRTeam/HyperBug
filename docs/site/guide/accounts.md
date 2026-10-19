# Accounts, access, and privacy

[Documentation home](../index.md)

**For:** Feedback participants and project staff.  
**Goal:** Understand sign-in, public visibility, and access to your account.

## Sign in and manage sessions

Open **Account → Sign in**. Credential entry and consent happen on the instance's authorization service. Available methods depend on its capability document. Your app access token stays in memory; after reload, start a fresh top-level sign-in. Unsaved drafts disappear on navigation, reload, identity changes, sign-out or denied access.

**Check access** verifies your current app access. Under **Authorization sessions**, confirm **Revoke session** to end a listed first-party authorization session. App access tokens are separate; use app sign-out to revoke this app’s token. **Sign out of this app** clears local private state and attempts to revoke this app's token. Its first-party authorization session is separate; the app reports if token revocation could not be confirmed.

Sensitive administration requires a recent verified passkey sign-in. When available, choose **Verify a passkey for sensitive actions**, then **Use a passkey** on the authorization service before authorizing access. If no passkey is enrolled, the signed-in consent page can offer **Register a passkey**; registration alone does not complete step-up, so then use the passkey to sign in. Password-only sign-in cannot satisfy this assurance requirement. Contact the operator when passkeys are unavailable.

## Understand public and staff identities

A Public User account can submit feedback and participate where permitted. It does not gain Staff privileges by sharing an email address or name. Project Triage, Maintainer and Administrator roles determine Staff actions; the server checks each operation. A visible control is not proof of permission.

## Know what others can see

Public issues and visible discussion can be read without signing in. Private projects, hidden/redacted content, restricted edit history and audit records use the instance's access policy. Attachment access is checked separately; uploading does not make a file released or publicly readable. Keep credentials and unnecessary personal information out of public reports. Drafts are not a private backup and are never stored by the app for later recovery.

## Recover access

An expired or denied app session offers a fresh sign-in. Recheck your role with the project administrator if an action remains denied. Do not repeatedly submit a sensitive action with password-only authentication. Account recovery methods depend on the operator's enabled providers and policy; this app does not promise email, SSO or a self-service recovery channel that the instance lacks.

## Verification scope

Local product journeys now pass on Node/PostgreSQL and both Workers tiers, supplemented by automated accessibility checks and the reported manual test matrix. Hosted backend acceptance and release readiness remain separate; this is not a complete device or assistive-technology matrix.

## Source references

[Identity plan](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/04-identity-and-access.md); [permission matrix](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-OPERATIONS.md).
