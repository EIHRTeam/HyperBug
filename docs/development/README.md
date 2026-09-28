# Backend development

Use Node 24.21.0 (`fnm exec --using=24.21.0 <command>` on this workstation) and pnpm 11.26.0. The existing `.node-version` selects major 24; `package.json` also rejects other majors. See [toolchain evidence](TOOLCHAIN.md) and the [runtime decision](../decisions/0001-runtime-foundation.md) with the [toolchain migration decision](../decisions/0004-oxc-toolchain-migration.md).

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

Use `pnpm format` to format files (`oxfmt`). Historical architecture and planning documents under `docs/**` and the guidance skills under `.agents/**` are intentionally outside automatic formatting; `AGENTS.md`, the READMEs, the workspace configuration and `.github/**` are inside it. `pnpm lint` runs `oxlint` with `--deny-warnings` and then the import-boundary checker in `tooling/check-boundaries.mjs`; both must stay, because the linter matches import specifiers while the script resolves them to owning packages and reads package manifests. Type checking is `tsc` alone: `oxlint`'s type-aware mode is not adopted. Use `pnpm scan:secrets`, `pnpm scan:licenses` and `pnpm audit --audit-level high` for supply-chain checks. The repository signature scan is an initial known-pattern check, not a claim that every credential format can be detected; hosted secret scanning should remain enabled.

`pnpm build` runs `tooling/build.ts`, which rebuilds `dist/` for the Node entry, the Cloudflare API and ingress entries, and the workerd test fixtures. Use `node tooling/build.ts --target=node|cloudflare|cloudflare-ingress|fixtures` to build one target. The Cloudflare output is a chunked bundle, so a lane that loads it in workerd must declare every emitted module rather than one entry file; `tests/fixtures/worker-modules.ts` does that. Test fixtures are emitted as single files, which is deliberate.

## Local servers

Copy `.env.example` to `.env` and run the Node entry point with explicit configuration:

```sh
node --env-file=.env --import tsx apps/api-node/src/index.ts
```

`pnpm dev:node` watches the entry point when the same environment is exported by your shell. Node listens on loopback by default. `pnpm dev:cloudflare` uses Wrangler's local environment. Both expose health and the narrow registration/login/session routes. Readiness probes the configured abuse key, current token-HMAC key, primary-counter/credential/session tables and the Workers approximate-limit binding; it is not full product readiness. The response reports the selected deployment tier, degradation IDs and required password-hash policy, but does not establish the complete account journey.

The standard Workers deployment has two Workers. `apps/api-cloudflare/wrangler.jsonc` defines the private API Worker; staging and production disable `workers.dev` and preview URLs. `apps/api-cloudflare/wrangler-ingress.jsonc` defines the public gateway and same-account `API` service binding. Provision one independent 256-bit base64url `HYPERBUG_INGRESS_KEY` secret to both Workers, keep it out of `vars` and repository files, and deploy the API Worker before the gateway. Route the public API hostname only to the gateway and keep the API Worker without public routes. The gateway rejects visible Worker-subrequest indicators and signs a short-lived client-IP assertion; the API rejects missing or invalid assertions before rate counters. The ordinary local API command has no ingress key, so IP-required registration remains closed; the local multiworker test proves the configured path. Before enabling a deployed account route, verify the target zone has no untrusted same-zone Worker that can spoof `CF-Connecting-IP`, test cross-zone and same-zone subrequests against the public hostname, and verify D1 binding and primary writes. See [ingress evidence](../plan/evidence/03-workers-ingress.md). `corepack pnpm types:cloudflare` and `corepack pnpm types:cloudflare-ingress` regenerate the separate environment declarations.

CAPTCHA needs no setup in the normal local command. To exercise configured Turnstile bindings, create the ignored `apps/api-cloudflare/.dev.vars.local-turnstile` file with `HYPERBUG_KEY_RING`, `HYPERBUG_ABUSE_KEY_RING`, `TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY` and `TURNSTILE_HOSTNAME`, then run `corepack pnpm dev:cloudflare`. That command automatically selects the `local-turnstile` environment when the file exists or any `TURNSTILE_*` binding is exported by the shell; partial or malformed provider bindings fail startup. You can also select it explicitly with `corepack pnpm dev:cloudflare:turnstile`. Wrangler loads those five names only for the `local-turnstile` environment; its D1 binding matches the ordinary local environment, while its approximate rate-limit namespace is separate. Keep the secret values out of `vars`, logs and committed files. Cloudflare's public test site keys and secrets are allowed only locally, never in staging or production. `GET /api/v1/accounts/register` now publishes the public widget key/action and `POST` requires configured verification after rate admission. The default, staging and production environments do not require Turnstile bindings, but a complete runtime binding set enables the gate automatically. Deployed Siteverify behavior remains unverified.

The Node root binds sensitive rate admission when `HYPERBUG_ABUSE_KEY_FILE` is supplied with exactly one PostgreSQL transport. For TCP, use `HYPERBUG_DATABASE_URL` without query parameters; local development permits only loopback and uses plaintext to a local database, while staging/production require certificate-verified TLS. For a local Unix socket, use `HYPERBUG_DATABASE_SOCKET_DIR` (absolute directory), `HYPERBUG_DATABASE_NAME` and `HYPERBUG_DATABASE_USER` together; this path has no network TLS segment. The abuse key file must be an absolute, current-user-owned regular file with mode 0400 or 0600 and contain the separate versioned abuse-key ring. An incomplete or mixed database transport refuses startup. With no database/key values, the health-only API still starts and sensitive admission stays closed. The pool is lazy, bounded to four clients with connection/query timeouts and drained on shutdown. The socket path passes an isolated PostgreSQL 18 registration HTTP check with real primary counters and atomic account storage; deployed database behavior remains unverified.

Set `HYPERBUG_KEY_FILE` to a separate private POSIX file containing the versioned cryptographic key ring when protected credentials or records need a key provider. It requires one complete PostgreSQL transport above, but does not require `HYPERBUG_ABUSE_KEY_FILE`; key-only setup leaves rate admission and readiness closed. When both files are supplied, they share the same bounded pool and use separate key sources. Supplying either file without the database transport refuses startup. Without the cryptographic key file, health-only startup is allowed, but a route requesting a cryptographic key fails closed. The Workers root uses its `HYPERBUG_KEY_RING` Secret binding and D1 key registry when D1 is bound. Neither profile reads raw key material from ordinary runtime configuration.

Production and staging require explicit `ALLOWED_ORIGINS`; placeholders are deliberately absent from those Wrangler environments. Local HTTP origins are restricted to loopback. The shared boundary enforces the allowlist, bounds JSON structure/query input, and returns catalogued safe errors. See [Core security foundation](../SECURITY-FOUNDATION.md) for validated settings, permission-resolver integration and retention handoffs. `DEBUG=true` is accepted only in the explicit local environment and never exposes exception payloads. Debug fixtures exist only under `tests/fixtures`; never deploy them.

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

Node tests open an actual HTTP listener. workerd tests dispatch prebuilt bundles through Miniflare: the production Cloudflare artifact for the entry and HTTP proof fixtures, and a separate D1 fixture for the repository suite. These are local runtime evidence, not a cloud deployment. No SPA, auth implementation or later feature module is started. Phase 10 still owns backend acceptance before SPA work.

The stable Elysia lane is required. A separate next lane remains optional and deferred; the currently published next is a different major (2.0 beta), so updating it in a required lane would violate the chosen baseline.

## Local databases and object storage

Run `pnpm test:database` for D1 inside workerd and PostgreSQL 18, including migrations, concurrency, rollback and larger query fixtures. Run `pnpm db:check` for both Drizzle histories. Generation/application/recovery commands are documented in [the migration workflow](MIGRATIONS.md).

`pnpm dev:storage` starts the pinned Miniflare 5.20260916.0-alpha R2 S3-compatible service on loopback port 7878. Random credentials and the path-style endpoint/bucket are written to ignored `.local/s3.json` with mode 0600; object state lives in ignored `.local/s3-data`. Ctrl-C stops the service and removes its credential file. A crash can leave the credential file: verify the old service has stopped before removing that stale file and restarting. Existing local objects remain across normal restarts; remove only this task's local data directory when deliberately resetting fixtures. No credential is committed or printed by the launcher.

The storage test exercises actual signed HTTP PUT/HEAD/GET/DELETE and rejects invalid signatures. It proves this local emulator's S3 surface, not live S3/R2 immutability, multipart, presign or production BlobStore support; module 07 owns those checks. No container runtime is required for local tests. CI uses `postgres:18.6`, verified in the hosted acceptance run linked from module 01 evidence; this workstation uses PostgreSQL 18.6 Homebrew binaries.

Run each runtime lane in its own Vitest process as the scripts do. Combining Node HTTP and workerd in one Vitest process exposed hangs. Both HTTP suites now verify incoming request abort and cooperative cleanup with a 50 ms stream heartbeat. workerd detects the closed peer on its next write, so later long-lived streams need bounded heartbeat intervals and deadlines. Run `node tooling/probe-workerd-disconnect.mjs` for the bare direct-socket reproducer. See the module 01 evidence for the original idle-stream failure, its resolution and passing hosted-CI acceptance.
