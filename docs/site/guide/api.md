# Use the public API

[Documentation home](../index.md)

> Status: Outline only. Product steps and examples are pending implementation and verification.

**For:** Client and integration developers.  
**Goal:** Prepare a versioned API consumer guide.

## Locate the accepted API contract

To write: Link the released OpenAPI artifact and generated client when module 10 supplies them. Existing contract documents specify intended behavior; only health routes currently exist.

## Authenticate and authorize requests

To write: Reserve tested credential acquisition, expiry/revocation handling and project-scoped permissions. Browser clients must keep access tokens in memory.

## Read and write resources

To write: Reserve verified examples for lists, detail, creation, discussion, structured search, and attachment upload/finalization.

## Handle limits and failures

To write: Explain accepted pagination, conflict handling, idempotency, errors, retry rules and resource bounds using tested examples.

## Track compatibility

To write: Reserve API version policy, client compatibility, content representation choices and deprecation guidance.

## Completion requirements

Examples run against both accepted profiles and match the published schema, permissions and error responses.

## Source references

[API conventions](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-CONVENTIONS.md); [resource inventory](https://github.com/EIHRTeam/HyperBug/blob/main/docs/API-OPERATIONS.md); [backend acceptance](https://github.com/EIHRTeam/HyperBug/blob/main/docs/plan/modules/10-backend-acceptance.md).
