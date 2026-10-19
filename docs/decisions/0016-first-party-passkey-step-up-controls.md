# ADR 0016: First-party passkey controls for browser administration

Date: 2026-10-18. Status: Accepted and locally verified under the user-directed Module 12 scope; [focused review](../plan/evidence/12-focused-review.md) and [browser acceptance](../plan/evidence/12-browser-acceptance.md). Owner: Module 04 prerequisite for 12.3b–c.

## Problem

Sensitive administration already requires recent assurance 2. Password-issued browser tokens have assurance 1. The authorization origin exposes real passkey registration/login APIs, but its script-free authorization pages have no passkey controls. Repeating password sign-in cannot recover a rejected administrative action. The product SPA must not weaken assurance or perform cookie-backed authentication across sites.

## Decision

Add optional backend-owned passkey controls to the existing validated authorization pages, served only when the instance has its existing passkey relying-party configuration. The consent page offers explicit registration using the current first-party session, and both login/consent pages offer discoverable passkey login. A fixed external script on the authorization origin drives the already-accepted registration/login endpoints and native WebAuthn. No credential, bearer token or PKCE verifier enters that script or persistent browser storage. Reload after successful passkey login retains the exact previously validated authorization request; the existing consent/PKCE exchange carries its new ceremony facts.

Only these pages add exact `'self'` to script-src/connect-src, retaining the reviewed exact CAPTCHA origin where enabled. There is no inline/eval script, arbitrary destination, new factor/protocol, permissive callback, weakening of CSRF/Origin checks, or auth request from the SPA. The script accepts only bounded same-origin JSON and produces the established WebAuthn JSON envelopes. Native cancellation and unsupported secure-context APIs produce explained errors. CAPTCHA remains required on final passkey login when configured; it is never bypassed.

Passkey registration remains an explicit account action with the existing authenticated, recent-session, verification and audit policy; a software virtual authenticator proves only the local browser ceremony, not hardware attestation. The backend still verifies user verification, challenges, RP/origin and replay state, issues assurance 2 only for successful passkey login, and checks recent authentication on every sensitive mutation.

## Consequences and acceptance

Existing password-only/unsupported deployments keep their script-free pages and capability explanations. A backend asset is excluded from the public API client because it is a first-party browser resource, not a business API. Module 04 progress records the prerequisite; G1/Module 10/13.G6 remain incomplete. Required focused tests cover CSP origin/callback invariants, unavailable passkeys, native registration/login, current ceremony token propagation, cancellation/replay and retained password-only rejection. Manual assistive-technology and production provider acceptance remain separate evidence.

## Local acceptance checkpoint — 2026-10-19

All three local production-SPA profiles exercise the fixed asset, native virtual-authenticator registration/login and actual PKCE step-up while retaining password-only denial. The asset also recovers from a one-shot simulated native `NotAllowedError`, with the original credential method restored before the subsequent native login. This is an API-boundary cancellation regression, not a claim of physical-device cancellation or attestation. Workerd/D1 and PostgreSQL OAuth/passkey suites pass 4/4 each, including existing CAPTCHA and challenge-replay denial. Page tests retain unsupported script-free behavior, escaping and exact CSP/callback invariants. The user reported all requested manual 12.V4 checks pass; exact assistive-technology version was not supplied. The focused implementing-agent review records no unresolved security finding in this scope. No normative baseline is relaxed; production deployment/provider acceptance and G1 remain separate.
