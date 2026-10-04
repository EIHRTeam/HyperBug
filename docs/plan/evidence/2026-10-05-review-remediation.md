# Review remediation record (2026-10-05)

Cross-module record for the remediation of two review reports supplied by the user on 2026-10-05: a performance and resource review of Cloudflare Minimum and a design/over-defense review. Both reviewed baseline `45d6065`; exploration re-verified every finding on `0d0d50c`. Owning module progress records carry summary entries that link here.

## User decisions

- Cloudflare Minimum becomes a formal profile with public PBKDF2 password accounts. A new ADR supersedes the 600,000-iteration floor rule. The tier is renamed `cloudflare-minimum`, and `cloudflare-free-minimum` is accepted as a deprecated alias. G1/G2 cover three profiles: Node + PostgreSQL, Cloudflare Standard and Cloudflare Minimum. 13.G6 remains the additional real-Free budget gate.
- The global Origin allowlist stays (SECURITY §43 MUST). The review suggestion to relax it is declined.
- The Module 09 hold is lifted only for bounded expired-data cleanup on the existing cron and Node interval (no Queues or Workflows).
- Audit work is limited to making Module 04/05 account, role and plugin audit writes atomic. Module 06+ audit stays suspended. No SPA. Argon2id performance work stays stopped.
- Each verified batch is committed as a Conventional Commit. The protected `SECURITY.md` draft and the two review files are never staged.

## Item map

| Review item | Batch | Status |
| --- | --- | --- |
| D1 relation query over the 100 bind-parameter limit (PERF 3.1) | B1 | Fixed |
| Issue create approaching the 50-query invocation limit (PERF 3.2) | B1 | Fixed |
| Hidden-issue sub-resource visibility (PERF 3.3) | B2 | Fixed |
| Instance vs project permission mixing (DESIGN 3.1) | B3 | Pending |
| Assurance not bound to the presented token; `ADMIN_RECENT_AUTH_SECONDS` unused (DESIGN 3.2) | B3 | Pending |
| Recovery-code regeneration without step-up (DESIGN 3.3) | B4 | Pending |
| Audit committed separately from Module 04/05 mutations (DESIGN 3.4) | B4 | Pending; 06+ audit stays suspended |
| Passkey login fails when CAPTCHA is configured (DESIGN §8 P1) | B4 | Pending |
| Session touch on every validation (PERF 4.1) | B5 | Pending |
| Duplicate public-read project/authorization queries (PERF 4.2) | B6 | Pending |
| Key ring re-read and re-import per call (PERF 5.2, 5.3) | B7 | Pending |
| Minimum password floor, rename, activation coupling, bundle (PERF 5.1, 5.4; DESIGN 2, 5) | B8 | Pending |
| Risk-tiered rate limits (PERF 4.3; DESIGN 4.1) | B9 | Pending |
| Unconditional `no-store` (PERF 6.1; DESIGN 4.2) | B10 | Pending |
| Workers Cache and two-Worker request counting (PERF 6.2) | B10 | Investigation only |
| Cron cleanup consolidation (PERF 7.1) | B11 | Pending |
| Receipts on one-shot mutations (PERF 4.4) | B12 | Pending |
| Fixed short timeouts; unused configuration (DESIGN §4) | B13 | Pending |
| `createApp` composition size; plugin executor limits (DESIGN 6.2, 6.3) | B14 | Pending |
| Observability sampling (PERF 7.3) | B14 | Pending |
| Queues as optional dispatch (PERF 7.2) | — | Deferred (Module 09 hold kept for Queues) |
| Global Origin allowlist relaxation (DESIGN §4) | — | Declined: SECURITY §43 requires validating any browser Origin |
| Content security priority (DESIGN 6.4) | — | Continues under Module 07; not part of this remediation |

## Batch log

### B1 — D1 bind/statement bounds and batched relation writes (2026-10-05)

- Change:
  - **D1 bounded ID sets.** Every bounded ID set binds as one JSON array expanded by `json_each`: issue relations, reference count checks, form-submission guards, form default lookups and reaction counts. `placeholders()` is gone from the D1 adapter. Statement bind counts are now fixed regardless of page size.
  - **D1 relation writes.** Issue create and label/assignee replacement insert each relation set with one `INSERT ... SELECT ... FROM json_each(?)` instead of one statement per row. Worst-case create (20 labels, 10 assignees) drops from 37 batch statements to 9.
  - **PostgreSQL relation writes.** Set-based `INSERT ... SELECT $1, $2, unnest($3::uuid[])` replaces up to 30 sequential round trips.
  - **Unchanged:** foreign keys, primary keys, reference pre-checks, receipts, timeline and outbox atomicity.
- Files:
  - `packages/database/d1/src/{index,comments,content-definitions}.ts`, `packages/database/postgres/src/index.ts`
  - New test guard `tests/fixtures/d1-bind-guard.ts`, used by `tests/fixtures/{database-worker,account-worker}.ts`
  - `tests/fixtures/repository-contract.ts` and `tests/{workerd,postgres}/acceptance-queries.test.ts`
- Verification (local; Node 24.21.0):
  - `vitest --project workerd` on the acceptance-queries and repository suites: 172 passed, 2 skipped (workerd/D1 emulation).
  - `test:postgres` on the same suites: 158 passed, 2 skipped (real isolated PostgreSQL 18.6).
  - New cases:
    - a full 100-issue page with relations for 100 and 101 IDs and 101-ID reaction counts;
    - worst-case create and set replacement at no more than 14 statements, with two relation inserts;
    - the shared contract creating and replacing 20 labels and 10 assignees, with all-or-nothing rejection of a foreign reference.
  - Restoring the previous D1 adapter makes the full-page case fail at the bind guard, confirming the original defect and the guard.
  - Full lanes after wiring the guard into every D1 fixture: `test:workerd` 257 passed, 2 skipped; `test:postgres` 178 passed, 2 skipped.
  - `typecheck`, `lint` and boundaries pass.
- Notes:
  - Local Miniflare does not enforce D1's 100-parameter limit, so the guard is the regression net.
  - HTTP issue journeys cannot cheaply seed ten Staff assignees, so maximum relations are proven at the shared repository contract on both adapters. All D1 route fixtures now run behind the guard.
  - Whether statements inside one `db.batch()` count individually toward the Free 50-query limit is not stated in the current documentation (Context7 `/llmstxt/developers_cloudflare_d1_llms-full_txt`, 2026-10-05). B15 measures it on the real Free account.

### B2 — Parent-issue visibility for every issue sub-resource (2026-10-05)

- Change:
  - **Shared parent check.** One `requireIssueAccess` step resolves the caller's moderator status once, then probes the parent through the new `IssueRepository.issueVisible` (`SELECT 1`, no body or relations). It answers 404 when the parent is hidden (non-moderators) or deleted (everyone).
  - **Routes covered:** comment list, read, create, edit, delete, moderate and history; issue and comment reactions and their counts; the timeline. The timeline no longer resolves moderation twice.
  - **Comment targets.** Moderation, history, comment reactions and comment reaction counts now also require the comment to belong to the addressed issue. Comment reactions additionally require the comment to be visible to the caller.
- Files:
  - `packages/server/src/discussion.ts`, `packages/application/src/index.ts`, `packages/database/{d1,postgres}/src/index.ts`
  - New shared matrix `tests/fixtures/discussion-visibility-contract.ts`, run from `tests/{workerd,postgres}/acceptance-negatives.test.ts`
  - Harness updates in `tests/fixtures/database-worker.ts`, `tests/workerd/repository.test.ts`, `tests/unit/attachment-media.test.ts`
- Verification (local):
  - **Shared matrix** on workerd/D1 and real PostgreSQL 18.6, through the acceptance-negatives suites. It covers every sub-resource route for anonymous, author (User) and moderator, against hidden and deleted parents, plus cross-issue comment addressing.
  - **Old handlers fail it.** With the previous `discussion.ts`, the matrix fails because history through another issue answers 200.
  - **Related suites pass:** workerd discussion/journey/queries/concurrency, PostgreSQL negatives/discussion/journey/queries, unit 345.
  - **Static checks:** typecheck, lint and format pass.
- Notes:
  - Authenticated callers that previously skipped the moderator lookup (comment create, reactions) now perform it. B6 removes the repeated authorization reads per request.
  - No shared cache is enabled for these resources.

## Documentation lookups

- 2026-10-05, Context7 `/llmstxt/developers_cloudflare_d1_llms-full_txt`:
  - D1 limits: 100 bound parameters per query; 50 queries per Worker invocation on Free and 1,000 on Paid; a 100 KB statement limit that applies to each batch member.
  - `json_each` expansion of a JSON array bound parameter for `IN` queries.
  - `batch()` executes statements sequentially as one transaction that rolls back on failure.
  - Gap: per-statement accounting of batch members against the invocation query limit is not documented.
