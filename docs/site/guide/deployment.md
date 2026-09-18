# Plan an installation

[Documentation home](../index.md)

> Status: Outline only. Product steps and examples are pending implementation and verification.

**For:** Deployment operators.  
**Goal:** Choose a backend profile and understand the separately hosted frontend.

## Choose a backend profile

To write: Describe the two required profiles: Workers/D1/R2/Queues/Workflows and Node 24/PostgreSQL 18.x/S3-compatible storage/Graphile Worker. These are architecture targets, not production compatibility evidence.

## Plan domains and configuration

To write: Outline frontend, API, authorization and media origins, TLS, exact origin allowlists, secrets and public runtime configuration.

## Install and initialize

To write: Link the profile outlines and reserve verified release selection, migrations, initial administrator setup and smoke checks.

## Review compatibility and readiness

To write: Reserve a tested provider/version/feature matrix, release artifact references, resource quotas, and known limitations. Workers with PostgreSQL/Hyperdrive is outside guaranteed profiles.

## Completion requirements

Fresh installations pass for both profiles with verified configuration, bootstrap, and recorded provider versions.

## Source references

[Release checklist](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md); [runtime decision](https://github.com/EIHRTeam/HyperBug/blob/main/docs/decisions/0001-runtime-foundation.md).
