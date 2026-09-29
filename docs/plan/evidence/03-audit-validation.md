# Phase 03 audit service validation

Owner: [03.3a](../modules/03-security-foundation.md) and [03.V4](../modules/03-security-foundation.md), with input to the audit portions of 03.3d, 03.3g, 03.V6 and 03.V7. Status: **03.3a accepted on 2026-09-29** after the [audit resume](../AUDIT-SUSPENSION.md#resume-2026-09-29--module-03-audit-only). The service was restored from the parked 2026-09-21 snapshot by reviewed re-integration (commit `b8170d8`); the snapshot's two recorded follow-ups — D1 seed batching and explaining the actual adapter query — are fixed.

## What is implemented

- `packages/security/src/audit.ts`: a closed audit-event catalog (`issue.created`/`issue.edited`, `key-registry.*`, `authorization.checked`) with a strict validating constructor; `createAuditService().check()` audits a permission decision, fails closed on any failure, and re-authorizes after the audit write so a slow write cannot revive expired permission; `createAuditService().read()` re-authorizes `audit:read` before and after every bounded cursor page and revalidates each returned row, refusing cross-project rows and secret-bearing/corrupted metadata; `auditRetentionProposal()` produces only a frozen review proposal (cutoff, batch bound, legal-hold refusal) with no deletion path in the ordinary repository.
- `packages/database/{d1,postgres}/src/audit.ts`: append-only `AuditRepository` adapters. D1 uses `first-primary` sessions and single-row inserts; PostgreSQL uses bounded transactions with 1000 ms statement/lock timeouts. Both validate `changes`/`rowCount` and re-parse every listed row.
- Audit remains distinct from diagnostics: audit events are structured, append-only and permission-gated; diagnostics keep the 03.1c redaction/catalog rules and never become audit records.
- Retention cleanup is controlled: the proposal helper bounds the cutoff/batch, refuses legal holds, and requires independent review; retention settings themselves are the accepted 03.1d configuration.

## Local verification (Node 24.21.0)

| Check | Command | Result |
| --- | --- | --- |
| Unit corpus (fail-closed, validation, key identity, admission bounds) | `corepack pnpm exec vitest run --project unit tests/unit/audit.test.ts` | 4/4 |
| Unit + contract suites | `corepack pnpm exec vitest run --project unit --project contract` | 103/103 |
| Node runtime | `corepack pnpm exec vitest run --project node` | 50/50 |
| workerd incl. in-worker authorization/failure/redaction corpus and 4000-event D1 traversal | `corepack pnpm exec vitest run --project workerd` | 111/111 |
| Isolated PostgreSQL 18.6 repository incl. audit contract and traversal | `corepack pnpm test:postgres` (repository file) | 55/55 |

The shared persistence contract proves: exactly-once append under concurrent duplicate IDs; UPDATE/DELETE rejected by the append-only triggers; stable cursors across equal timestamps with cross-project/registry rows excluded; cursor forgery rejected; append failure never grants; corrupted stored metadata never returns secret-bearing rows; malformed bounds and pre-cancelled signals leave no partial writes. The measured 4000-event traversals stay on `audit_project_order` with no temp B-tree (D1) and no Seq Scan/`Rows Removed by Filter` (PostgreSQL); samples: [d1](03-d1-audit-query.json), [postgres](03-postgres-audit-query.json) — local plan samples, not deployment claims.

## Test-only deployed verification (2026-09-29)

A capability-guarded temporary Worker (`hyperbug-phase03-audit-verify`) ran the real service and adapter against the isolated `hyperbug-test-1` D1 (migrations 0000–0011 applied) from the logged-in Cloudflare account. Observed outcomes over its HTTP interface:

| Phase | Outcome |
| --- | --- |
| authorized | `check` appended an `authorization.checked` event and returned allowed; a direct `issue.created` append persisted; the re-authorized read returned both actions newest-first with a correct cursor boundary |
| unauthorized | read denied `AUDIT_FORBIDDEN` (denying authorization facts) |
| outage | read denied `AUDIT_UNAVAILABLE` (resolver failure) — fail-closed |
| tamper | `UPDATE` and `DELETE` against an existing row both rejected by the append-only triggers |

Diagnosis notes recorded honestly: the first deployed attempt failed on the `audit_events` foreign keys until the worker seeded the `projects`/`principals` parent rows the local contract seeds, and one intermediate tamper run mis-bound the DELETE statement; both were worker-fixture defects, corrected before the recorded passing run. The Worker was deleted afterwards and its URL returns 404.

Residue: five permanent audit test rows (one `authorization.checked`, four `issue.created`) with one parent project and one staff principal remain in `hyperbug-test-1`, referenced by those rows. They are undeletable by design (append-only triggers), clearly identified by the fixed test UUIDs `00000000-0000-4000-8000-0000000000b1`/`…b2`, and confined to this test-only database.


## 03.V4 acceptance: seeded-secret inspection and unauthorized audit access (2026-09-29)

03.V4's outcome — inspect logs, audit and errors for seeded secrets, and verify unauthorized audit access fails — is demonstrated by consolidating the existing verified evidence:

| Required inspection | Evidence |
| --- | --- |
| Logs carry no seeded secrets | `tests/unit/security.test.ts` "removes seeded credentials, bodies, provider messages and malformed identifiers from diagnostics" drives `SEEDED_SECRET` material through `jsonTelemetry`/`jsonSecurityTelemetry` lines and asserts absence; both-runtime HTTP fixtures transport a seeded bearer header without disclosure ([foundation evidence](03-security-foundation-validation.md), 03.1c). |
| Audit rows carry no seeded secrets | The audit corpus asserts `SEEDED_SECRET` never appears in failures or returned rows (`storedSecretNeverReturned`, `crossProjectProviderDenied`); the shared persistence contract sweeps `SELECT * FROM audit_events` for the seeded project and asserts absence; strict `auditEvent()` rejects secret-bearing metadata/targetId before storage; key-registry provider tests check audit rows for seeded plaintext, address, token, ciphertext and digest leakage. |
| Errors carry no seeded secrets | The safe-envelope suite proves `publicFailure` and catalogued errors never contain `SEEDED_SECRET`, including tampered expected-exception text (03.1c). |
| Unauthorized audit access fails | Locally: anonymous, user and maintainer principals and mid-read revocation all deny `AUDIT_FORBIDDEN`; cross-project and corrupted rows are never returned (`AUDIT_UNAVAILABLE` fail-closed). Deployed test-only: denying facts returned `AUDIT_FORBIDDEN` and a resolver outage returned `AUDIT_UNAVAILABLE` on `hyperbug-test-1`. |

Scope: these inspections cover the implemented audit service, diagnostic telemetry, error envelopes and both database adapters on both runtimes. They do not inspect later modules' not-yet-written audit integrations, whose audit portions remain suspended.

## Limits

This is local and test-only deployed evidence on an isolated Free-tier account database. It does not claim: production/staging deployment, the later modules' audit integrations (04.3a/04.3c/05.2a/05.3d/06.1c/06.2c/07.2e/09.3e remain suspended), executed retention deletion (the proposal is review-only by design), or live traffic. The audit portions of 03.3d, 03.3g, 03.V6 and 03.V7 remain open for their owning outcomes.
