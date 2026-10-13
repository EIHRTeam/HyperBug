# Install the self-hosted profile

[Documentation home](../index.md)

> Status: Outline only. Product steps and examples are pending implementation and verification.

**For:** Operators choosing the Node backend.  
**Goal:** Prepare the self-hosted installation walkthrough.

## Prerequisites and resources

To write: Reserve exact tested versions for Node 24, PostgreSQL 18.x, the selected S3-compatible provider and Graphile Worker; document resource and TLS requirements.

## Configure and install

To write: Reserve tested artifact acquisition, secret provisioning, database migration, API startup, job processing and initial administrator setup.

## Manage processes and storage

To write: Describe verified process supervision, graceful shutdown, storage permissions, health probes and media isolation once implemented.

## Verify and recover

To write: Reserve smoke checks, provider feature tests, failure signals, stop conditions and application/data recovery references.

## Completion requirements

Exercise the actual runtime/database/storage combination; generic S3 compatibility alone is insufficient evidence.

## Source references

[Deployment requirements](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md); [installation overview](deployment.md).
