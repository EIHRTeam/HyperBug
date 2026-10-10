# Install the Cloudflare profile

[Documentation home](../index.md)

> Status: Outline only. Product steps and examples are pending implementation and verification.

**For:** Operators choosing the Cloudflare backend.  
**Goal:** Prepare the Cloudflare installation walkthrough.

## Prerequisites and resources

To write: List verified account permissions and required Workers, D1, R2, Queues and Workflows resources when the deployment package exists.

## Configure and install

To write: Reserve tested bindings, secrets, database migrations, independent API and job deployment, and initial administrator setup.

## Connect the frontend and media

To write: Link static hosting instructions and specify exact origin configuration, isolated media delivery and quotas.

## Verify and recover

To write: Reserve smoke checks, failure signals, stop conditions, rollback references and evidence from an authorized staging rehearsal.

## Completion requirements

Record the release, resource configuration, verified provider tooling, and successful fresh-install and recovery rehearsal.

## Source references

[Deployment requirements](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/13-mvp-release-and-operations.md); [installation overview](deployment.md).

## Background capability limits

This section describes the unaccepted Minimum prototype. Hosted dispatch measured 15 ms and the search-batching follow-up measured 22 ms against the required 10 ms Free CPU limit, so this path remains blocked and is not accepted for deployment.

The instance capability document reports background mode, dispatch batch and job step ceilings. Minimum uses a checkpointed D1/Cron runner: one event or job step per corresponding phase, four steps per job and a 1,024-byte checkpoint. The existing five-minute Cron rotates five phases; each phase runs every 25 minutes. Bulk actions, import/export and long-running jobs remain unavailable. Queue or Workflow bindings are not required by Minimum.

Async work reserves a separate daily allowance of 1.5 million D1 reads and 30,000 writes. A denied reservation preserves pending work and reports backlog age. Each invocation stops at 45 SQL statements/combined subrequests, including diagnostic headroom. These allocations do not measure total account usage or guarantee Free CPU acceptance.

`ASYNC_ORPHAN_RETENTION_SECONDS` defaults to 86,400 seconds after intent expiry (range 3,600–31,536,000). `ASYNC_TERMINAL_RETENTION_SECONDS` defaults to 2,592,000 seconds (range 86,400–31,536,000). Failed events remain replayable during the terminal window; expiry retires their source and failure metadata atomically. Pending retries are preserved. Refer to the internal async processing runbook for authorized replay and recovery. The separate Minimum release acceptance gate remains open.
