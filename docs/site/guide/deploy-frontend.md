# Host the static frontend

[Documentation home](../index.md)

> Status: Outline only. Product steps and examples are pending implementation and verification.

**For:** Operators hosting the product web application.  
**Goal:** Prepare independent frontend hosting and backend pairing.

## Select artifacts and API compatibility

To write: Reserve frontend release artifacts and tested backend compatibility ranges. The product SPA has not started.

## Supply public runtime configuration

To write: Explain the eventual public config.json fields and validation; never place secrets in public configuration.

## Configure hosting

To write: Reserve tested Cloudflare Pages and generic static-server examples, SPA fallback, cache rules, security headers and CSP.

## Verify routing and sign-in

To write: Cover deep-link refresh, preview-to-staging pairing, exact origins, sign-in recovery and independent release rollback.

## Completion requirements

After G1, exercise the accepted SPA on both hosting examples and against both backend profiles.

## Source references

[Static web plan](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/11-static-web-foundation.md); [release checklist](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md).
