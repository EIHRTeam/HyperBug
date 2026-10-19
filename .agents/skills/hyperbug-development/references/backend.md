# Backend development

Read for backend features, API contracts, repositories, queues, and plugins. Use [SOURCES](../../../../docs/plan/SOURCES.md) to locate TECH-STACK §§3–30, 38–54, the relevant PRODUCT scope, and the owning [module](../../../../docs/plan/README.md#module-index).

## Boundaries that determine implementation

- Domain entities and public schemas have no infrastructure dependencies. Application services use repository/security/blob/queue/workflow ports. Adapters implement the ports; runtime composition roots supply them.
- Share Elysia routes and middleware in the server package. Runtime startup belongs in the Workers/Node entry points; D1 bindings, PostgreSQL pools, R2 buckets, S3 clients, and workflow objects must not leak into the domain.
- Publish versioned REST/OpenAPI and framework-independent DTOs. Clients do not import server implementation types or require Elysia to consume the contract.
- Keep Cloudflare and self-host behavior equivalent while allowing separate SQL, FTS, indexes, transactions, and infrastructure integrations. Resolve package/API details through current documentation; do not assume Node tooling capabilities exist in Workers.
- Preserve User/Staff separation, project-local Issue numbers, simple Open/Closed state, and optional provider integrations. Core is usable without an email, SSO, or CAPTCHA plugin.

## Complete a backend capability

Choose the owning checklist and define the request/response/error contract, object permissions, invariant, transaction intent, event/audit requirements, and resource bounds before exposing the route.

Implement domain/application behavior, each required repository adapter, route validation/error mapping, and contract evidence as one coherent feature. Where a mutation needs timeline/audit/outbox records, prove the intended atomic outcome. A zero-row conditional update is not automatically an exception or rollback.

Use [database changes](../../hyperbug-maintenance/references/database-migrations.md) for schema work and [security](security.md) for credentials, permissions, content, or trust boundaries.

## Query and side-effect decisions

Use bounded keyset/cursor pagination with stable unique tie-breakers and indexes matched to filter/sort/join patterns. Batch hydration rather than querying relations per result. Keep the structured search AST independent of FTS5 and PostgreSQL syntax and enforce current authorization even with stale indexes.

Record non-critical effects through the outbox/queue path. Assume at-least-once execution; bound fan-out/retries/concurrency and retain recoverable failures. Workflow steps need bounded checkpoints and replay-safe writes. See modules 08–09 for index dispatch and workflow handoffs.

Use upload intents, direct object-store upload, and verified finalization; do not buffer ordinary uploads through the API. Check object identity/immutability as well as declared metadata. Native plugins are trusted application code; declared permissions are not a sandbox.

## Acceptance

Use [testing](testing.md) to select both-runtime contract, authorization, concurrency, migration, and resource-bound checks. Record real versus emulated results and unresolved profile differences. Update public specifications/client contracts where affected and finish the [session handoff](session-handoffs.md).

