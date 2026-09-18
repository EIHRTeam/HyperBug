# Backend development

Use Node 24.21.0 (`fnm exec --using=24.21.0 <command>` on this workstation) and pnpm 11.26.0. The existing `.node-version` selects major 24; `package.json` also rejects other majors. See [toolchain evidence](TOOLCHAIN.md) and [runtime decision](../decisions/0001-runtime-foundation.md).

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm types:cloudflare
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:unit
pnpm test:contract
pnpm test:integration
pnpm build
```

Use `pnpm format` to format implementation files. Historical architecture documents are intentionally outside automatic formatting. Use `pnpm scan:secrets`, `pnpm scan:licenses` and `pnpm audit --audit-level high` for supply-chain checks. The repository signature scan is an initial known-pattern check, not a claim that every credential format can be detected; hosted secret scanning should remain enabled.

## Local servers

Copy `.env.example` to `.env` and run the Node entry point with explicit configuration:

```sh
node --env-file=.env --import tsx apps/api-node/src/index.ts
```

`pnpm dev:node` watches the entry point when the same environment is exported by your shell. Node listens on loopback by default. `pnpm dev:cloudflare` uses Wrangler's local environment. Both expose `/health/live` and `/health/ready` only. Readiness currently means the HTTP foundation initialized; it is not full product readiness. The server factory accepts a bounded, abort-aware readiness port for later dependency wiring.

Production and staging require explicit `ALLOWED_ORIGINS`; placeholders are deliberately absent from those Wrangler environments. Local HTTP origins are restricted to loopback. Debug fixtures exist only under `tests/fixtures`; never deploy them.

## Packages

- `contracts`: independent JSON schemas and DTO types.
- `domain`: entities and invariants without infrastructure imports.
- `application`: repository/transaction intents and use cases.
- `server`: one shared Elysia HTTP application and HTTP limits.
- `config`, `security`, `observability`: typed configuration, security mechanisms and telemetry ports.
- `database/d1`, `database/postgres`: isolated persistence implementations.
- `testing`: reusable test support as contracts emerge.
- `apps/api-cloudflare`, `apps/api-node`: composition and startup.

Packages export source TypeScript explicitly during development. Builds bundle workspace code into runtime entry points; external Node dependencies stay installed through the frozen workspace lockfile. Import checks cover package manifests, static/dynamic/type imports and relative cross-package imports. Product clients may depend on contracts, not server implementation types.

## Verification boundaries

Node tests open an actual HTTP listener. workerd tests bundle a fixture and dispatch through Miniflare. These are local runtime evidence, not a cloud deployment. No SPA, auth implementation or later feature module is started. Phase 10 still owns backend acceptance before SPA work.

The stable Elysia lane is required. A separate next lane remains optional and deferred; the currently published next is a different major (2.0 beta), so updating it in a required lane would violate the chosen baseline.

## Local databases and object storage

Run `pnpm test:database` for D1 inside workerd and PostgreSQL 18, including migrations, concurrency, rollback and larger query fixtures. Run `pnpm db:check` for both Drizzle histories. Generation/application/recovery commands are documented in [the migration workflow](MIGRATIONS.md).

`pnpm dev:storage` starts the pinned Miniflare 5.20260916.0-alpha R2 S3-compatible service on loopback port 7878. Random credentials and the path-style endpoint/bucket are written to ignored `.local/s3.json` with mode 0600; object state lives in ignored `.local/s3-data`. Ctrl-C stops the service and removes its credential file. A crash can leave the credential file: verify the old service has stopped before removing that stale file and restarting. Existing local objects remain across normal restarts; remove only this task's local data directory when deliberately resetting fixtures. No credential is committed or printed by the launcher.

The storage test exercises actual signed HTTP PUT/HEAD/GET/DELETE and rejects invalid signatures. It proves this local emulator's S3 surface, not live S3/R2 immutability, multipart, presign or production BlobStore support; module 07 owns those checks. No container runtime is required for local tests. CI uses `postgres:18.6`, verified in the hosted acceptance run linked from module 01 evidence; this workstation uses PostgreSQL 18.6 Homebrew binaries.

Run each runtime lane in its own Vitest process as the scripts do. Combining Node HTTP and workerd in one Vitest process exposed hangs. Both HTTP suites now verify incoming request abort and cooperative cleanup with a 50 ms stream heartbeat. workerd detects the closed peer on its next write, so later long-lived streams need bounded heartbeat intervals and deadlines. Run `node tooling/probe-workerd-disconnect.mjs` for the bare direct-socket reproducer. See the module 01 evidence for the original idle-stream failure, its resolution and passing hosted-CI acceptance.
