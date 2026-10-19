# Plan an installation

[Documentation home](../index.md) · [Cloudflare](deploy-cloudflare.md) · [Self-hosted](deploy-self-hosted.md) · [Frontend](deploy-frontend.md)

This is an unpublished release-preparation package, dated 2026-10-19. Local workflow acceptance is recorded; backend G1, MVP G2 and actual-Free 13.G6 remain open. Do not treat the package as production acceptance.

## Choose a profile

| Profile | Runtime / data / work | Verified scope |
| --- | --- | --- |
| Cloudflare Standard | Workers, D1, R2, Queues, Workflows | Native local workerd/D1/R2 and recorded hosted component slices; paid Standard remains unmeasured |
| Self-hosted | Node 24.21.0, PostgreSQL 18.6, S3, Graphile Worker | Real disposable local PostgreSQL/S3 and browser fixtures; no production proxy certification |
| Cloudflare Minimum | Explicit `cloudflare-minimum` / `minimum-v2`, D1/R2 with bounded Cron | Local full journey and limited real Free-account observations; no verified instance ceiling or full acceptance |

Workers + PostgreSQL/Hyperdrive is outside guaranteed profiles. Generic “S3-compatible” is not a support statement.

## Tested storage matrix

| Provider / version | Tested features | Limits |
| --- | --- | --- |
| SeaweedFS 4.48, official release archive SHA-256 `faa194e72a346755dc4404288b0561eb3c260351702901d8363024d5099bdd7d` | PUT/GET/HEAD/DELETE, metadata/type, conditional creation, signed PUT/GET/parts, checksum rejection, multipart completion/abort/discovery, bounded streaming, isolated legacy recovery | Real local service; upload-ID-only pagination compatibility is explicitly selected. No other version/provider inferred |
| Cloudflare R2 managed service (no operator-pinnable server version) | Actual binding/S3 signing, CRUD/multipart/discovery, exact CORS protocol and owned-fixture recovery in earlier evidence | Current product production scanner/bridge/CORS installation and paid-hosted integration are separate acceptance |
| Local R2/S3 emulation | Native fixture bindings and product browser lifecycle | Emulator evidence only; not a provider compatibility certification |
| Other S3 services / versions | Not tested | Run the compatibility suite before listing support |

## Capability and degradation matrix

| Capability | Standard / self-host | Minimum |
| --- | --- | --- |
| Passwords | Argon2id, source-minimum 19 MiB / 2 passes / 1 lane | FREE-01: peppered PBKDF2-HMAC-SHA256, 50,000 new / 100,000 stored maximum; weaker offline protection |
| Admission | Primary-backed identity checks plus approximate shedding | FREE-02: per-location approximate shedding plus mandatory D1 counters/lockout |
| Background work | Queues/Workflows or Graphile/PostgreSQL | FREE-03: D1/Cron, bounded retries/checkpoints, no >24-hour queue durability promise |
| Logs / audit | Complete required audit, separate diagnostics | FREE-04: shorter retention, Workers Logs 3 days, no Logpush/OTLP export |
| Capacity / search | Bounded title-and-body search | FREE-05: title-only search and quota caps; instance ceiling unverified |
| Email | Provider plugin, not part of current Core delivery | FREE-06: operator TLS SMTP relay required for arbitrary recipients; module 16 implementation remains unavailable |
| Recovery | Objectives require deployment-specific measurement | FREE-07: D1 Time Travel 7 days, no log export; separate measured objectives required |
| Bulk / jobs | Only implemented capability contracts; later product features remain deferred | FREE-08: bulk/import/export/long jobs disabled or capped |

Upgrading to Workers Paid does not silently switch the tier. Select Standard explicitly, remove the acknowledgement, provision its bindings and rebuild title-and-body search. Verified PBKDF2 passwords rehash to Argon2id on successful login. Before downgrading, inventory Argon2id credentials and arrange passkeys/recovery or an eligible reset; Minimum cannot verify Argon2id. Never lower existing costs to force migration.

Authorization, fail-closed verification, complete required audit, content sanitization/CSP, TLS/HSTS, keyed credential digests, AES-256-GCM envelope encryption and memory-only browser tokens remain mandatory on every tier. Online controls cannot offset offline guessing after both database and pepper compromise.

## Domains, quotas and release pairing

Plan separate frontend, API/authorization and isolated media/storage origins. Register exact callbacks, exact CORS and complete passkey RP settings. Keep secrets in private backend mounts/bindings. Release frontend assets/config/generated CSP together; previews pair with an explicitly isolated staging API, which is not created by this package.

Provider facts rechecked 2026-10-19: Free CPU 10 ms/invocation, 100,000 requests/day, D1 5 million rows read/100,000 written per day, 500 MB/database, Queues 10,000 operations/day and 24-hour retention, Workers Logs 200,000 events/day/3 days, D1 Time Travel 7 days. These are account ceilings, not application capacity promises. Reserve headroom for diagnostics, other services and unknown-origin traffic. See [Cloudflare operations](deploy-cloudflare.md) and [recovery](operations.md).

[Current release evidence](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/evidence/13-release-readiness.md) distinguishes prepared artifacts, local exercises and missing deployment acceptance.
