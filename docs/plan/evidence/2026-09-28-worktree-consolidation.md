# 2026-09-28 worktree consolidation

This record covers the user-directed stabilization of the existing, uncommitted backend and documentation work. No new product scope, SPA work, audit implementation, Argon2id performance measurement, Free-tier activation, or staging/production rollout was undertaken. Module 04 account routes and the Module 09 counter cleanup remain narrow dependencies of Phase 03; their checklists and G1/G2 remain open.

## Migration inventory

The existing SQL, Drizzle snapshots, and journals were committed unchanged in their reviewed order. New D1 history ends at `0011_authorization_sessions.sql`; PostgreSQL ends at `0010_authorization_sessions.sql`. The only table rebuild in these additions is the previously exercised D1 `0008_password_pepper.sql`, which uses deferred foreign keys, restores lifecycle triggers, and checks the foreign-key graph. No migration was applied during this consolidation.

| Store | Read-only observation | Limit |
| --- | --- | --- |
| Remote test D1 `hyperbug-test-1` | Wrangler 4.141.0, with the exact test database UUID and selected account, reported no pending migrations; a primary read of `d1_migrations` returned `0000`–`0011` in order. | Test database only. D1 history records filenames, not source checksums; this observation alone cannot prove byte identity of previously applied SQL. |
| Local development D1 `hyperbug-local` | Wrangler listed `0009`–`0011` pending; local `d1_migrations` contains `0000`–`0008`. | Local state was inspected, not advanced. |
| PostgreSQL | No `HYPERBUG_MIGRATION_DATABASE_URL` or application database URL was present. The isolated PostgreSQL 18.6 cluster applied and verified the complete `0000`–`0010` checksum-checked history in its repository tests. | No persistent, staging, or production PostgreSQL migration state was available for inspection. |

The read-only D1 commands followed a 2026-09-28 Context7 resolve/query for Cloudflare D1's [Wrangler migration listing](https://developers.cloudflare.com/d1/wrangler-commands/), then were checked against the installed CLI. The first remote attempt stopped because two accounts were available; a read-only database list identified the exact test UUID before retry. No command targeted staging or production.

## Sensitive material and retained local state

`corepack pnpm scan:secrets` passed on tracked and untracked candidate files; an untracked filename inventory found no `.env`, `.dev.vars`, private-key, certificate, or database file. The scanner covers known credential signatures, so it is a bounded check. The only new editor file is `.vscode/settings.json`, which enables Markdown validation. The pinned `libsodium-sumo` Wasm SHA-256 is `29dd7daf12daec2afdf7b73101e50679bfe9c38861aa1f0de50ae505ccba99bd`, matching the recorded provenance.

Ignored `.local/`, `apps/api-cloudflare/.local/`, local Wrangler state, and the parked audit snapshot under `.local/phase03-suspended-audit/` were preserved and excluded from commits. These directories may hold test configuration and diagnostics and were not treated as publishable source.

## Verification and consolidation result

All formal checks used Node 24.21.0 and pnpm 11.26.0. `corepack pnpm install --frozen-lockfile --offline`, `typecheck`, `lint`, `db:check`, `format:check`, `build`, `docs:build`, `scan:secrets`, and `scan:licenses` passed. The full local suite passed 301 tests: 99 unit/contract, 50 Node, 103 workerd, and 49 isolated PostgreSQL. The committed code was then exported to a fresh temporary directory; its frozen offline install and typecheck passed. Its first full test run had one 15-second timeout in the Wrangler dry-run/Wasm case; a focused rerun and a second full run passed all 301 tests. The timeout's cause is unproven.

The first working-tree test run exposed three stale expectations rather than a production behavior failure: the unconfigured Node registration route now denies at the earlier rate-limit dependency, PostgreSQL readiness now requires a token key, and the new session migration raises the PostgreSQL migration/table counts. These assertions were corrected and the affected suites rerun. The successful build still emits Rolldown's external `cloudflare:workers` import hints, and the PostgreSQL suite emits a nonfatal `MaxListenersExceededWarning`; neither is claimed resolved.

The pre-existing changes were separated into Conventional Commits for shared policy/crypto/admission, ordered dual-dialect migration history and stores, shared routes, each runtime profile, build wiring, and documentation. No `reset --hard`, `clean`, forced checkout, migration rewrite, or deletion of local state was used.

| Dependency slice | Commit span |
| --- | --- |
| Shared policy, crypto, abuse, and password contracts | `bb9e986`–`fa51012` |
| Migration history and dual-dialect stores | `2acc847`–`301530a` |
| Shared HTTP and account admission | `120452c`–`a021649` |
| Node/PostgreSQL profile | `8a8bd9b`–`0297748` |
| Workers/D1 profile | `8942a9d`–`dce9007` |
| Build wiring | `5e16a49` |
| Security, migration, toolchain, and bilingual documentation | `e16747e`–`e497403` |
| Plan, guidance, and module handoffs | `be48923`–`cf7bbb2` |

## Remaining boundaries

The remote test D1 and isolated PostgreSQL results do not establish staging/production migration status or deployed acceptance. Genuine Workers client provenance, a valid live Turnstile challenge, Node direct TLS egress, cross-location/outage consistency, and measured route budgets remain open in their existing evidence records. Audit work and Argon2id performance work remain suspended; the Free tier remains startup-disabled. No Module 04/09 expansion or SPA implementation was performed.
