# Build and manage extensions

[Documentation home](../index.md)

> Status: Outline only. Product steps and examples are pending implementation and verification.

**For:** Extension authors and administrators evaluating plugins.  
**Goal:** Prepare an extension quickstart and lifecycle guide.

## Understand trust and Core policy

To write: Explain that native plugins are trusted code and cannot weaken Core policy; arbitrary untrusted-code hosting is deferred.

## Build a minimal extension

To write: Reserve the versioned public specification, SDK, manifest, capabilities and conforming example after module 05 acceptance.

## Configure and manage lifecycle

To write: Cover compatibility checks, public versus secret configuration, enable/disable, upgrades, namespaced data, and explicit removal/retention policy.

## Handle events and failures

To write: Reserve tested hook limits, failure behavior, durable side effects, idempotency and scoped external-service boundaries.

## Choose optional integrations

To write: Keep named provider integrations in the post-MVP roadmap until individually accepted; do not imply they ship with Core.

## Completion requirements

The example uses the public SDK and passes lifecycle, compatibility, authorization and failure tests on both profiles.

## Source references

[Plugin plan](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/05-plugin-foundation.md); [integration plan](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/16-official-integrations.md).
