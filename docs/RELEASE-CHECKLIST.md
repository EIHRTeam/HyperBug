# Prepared release checklist — 2026-10-19

Owner: Module 13. Branch: `feat/v1`. Outcome: **prepared but unpublished**. No staging, production publishing, GitHub Pages publication, main, push, merge or PR edit is authorized. This checklist is a concrete handoff, not rollout permission.

| Decision/input | Current candidate |
| --- | --- |
| Product source baseline | `9b78e06`; Module 13 changes packaging/docs/tooling/recovery fixtures, not backend/product policy |
| Preparation commits | B1 `067b453`, B2 `9c1f763`, B3 `c089c64`; B4/final commits recorded in progress |
| Exact source/artifacts | [Unsigned source/build/hash manifest](plan/evidence/13-release-manifest.json), including lockfile and input digests |
| Install/build | Node 24.21.0, pnpm 11.26.0, frozen lockfile, explicit lifecycle allowlist, `corepack pnpm build`, `corepack pnpm docs:build` |
| Deployable paths | `dist/node`, `dist/cloudflare`, `dist/cloudflare-minimum`, `dist/cloudflare-ingress`, `apps/web/dist`; docs site separate `docs/.vitepress/dist` |
| Migrations | Existing 36 D1 / 33 PostgreSQL SQL histories; no new migration in Module 13; inspect exact checksums in manifest |
| Local data services | PostgreSQL 18.6 and real SeaweedFS 4.48; native local workerd/D1/R2 separately labelled |
| Free evidence | Tiny service witnesses only; user-attested plan/billing gaps, no new Worker/API pilot, owned resources zero |
| Documentation publication | Content/build only; main-triggered workflow exists but has not been dispatched or published here |
| Release identity | Unpublished dated candidate, no release/tag/registry package created |

## Required release decisions still pending

- [ ] Resolve Module 10 Standard/profile metrics/capacity and P0 gaps before claiming backend G1 or release security/performance acceptance. Module 10 stays Blocked; this mission changes none of its state.
- [ ] Establish authorized isolated staging, exact environment/resource IDs, verified TLS/client-IP/scanner boundaries and bounded auth/abuse load evidence (13.3b). No staging exists in this mission.
- [ ] Complete Minimum current-password Free CPU/quota/capacity/full-resource recovery evidence and SMTP scope decision before closing 13.1f/13.2g/13.G6. Do not inherit Standard objectives or treat the tiny D1/R2 drill as a full-profile restore.
- [ ] Authorize an exact production environment and rollout window separately, and authorize Pages publication separately. Never publish because artifacts are prepared.
- [ ] Recheck documented provider quotas/Logs pricing before a later rollout, especially the announced December 1, 2026 pricing transition. Obtain measured deployment-specific RPO/RTO and alert destinations.

## Before any later authorized rollout

1. Select the exact reviewed source/input hashes and artifact manifest. Re-run only checks invalidated by a changed candidate/environment. Preserve third-party notices and the moderate Drizzle development-tool advisory disposition. A hash is not a signature; establish a trusted signing/provenance identity if required by the release channel. All 39 application artifacts reproduce exactly on this workstation; documentation bytes vary between same-input builds, so retain the exact selected artifact hashes and investigate before claiming bit-for-bit documentation reproducibility.
2. Inventory and separately protect target database/blob/config/key/role state; pin all required historical keys before a quiesced coordinated backup. Test that snapshot in isolation, including current revocations, attachment integrity and pending effects. Record the accepted write-loss window.
3. Replace all template domains/resource IDs; privately supply complete keys/abuse/ingress/storage/Turnstile/bootstrap/RP/client settings as selected. Validate exact CORS, media isolation, public-only runtime config, generated CSP/cache policy and complete native bindings. A public policy check is not provider readiness.
4. Review pending immutable migration history under migration-owner credentials. Verify oldest-Staff role backfill and existing assurance1 credentials if those upgrades are pending on that target. Stop on unexpected prefix/checksum, data violation, missing key or unclear recovery.
5. Apply the compatible database sequence, then private API/worker and controlled ingress; stop old dispatchers for search-mode changes. Node is the combined API/Graphile process; drain it on SIGTERM. Do not invent an independent worker CLI or an unverified proxy trust mode.
6. Check actual hostname certificate/HSTS and direct-listener isolation, primary readiness, initial enrollment/passkey recovery, real allowed/denied bearer reads/writes, current revocation, safe Markdown, direct upload/scanning/quarantine/released media, search and an idempotent deferred effect. Stop on integrity/auth/audit/provider failures; hosted harness requests retain attributed10ms CPU stop rules.
7. Release frontend/config/headers together only after API compatibility. Confirm direct deep links, correct config origin, no-store config/private API, immutable hashed assets, restrictive CSP, first-party PKCE and memory-only browser tokens. Retain older assets for open tabs; previews pair only with explicitly isolated staging.
8. Publish the bilingual reader site/release notes only when that exact action is authorized. Record actual destination/job/artifact identity and observed outcome; prepared content never proves publication.

## Stop and recovery path

Stop rollout for failed smoke, unavailable mandatory keys/audit/authorization, schema mismatch, unresolved blob integrity or unexpected quota/CPU failure. Inspect ambiguous provider state before retrying. Restore the prior app/config/header artifact slot only when compatible with the current schema. Do not undo data migrations by replacing application files. Use a reviewed forward fix or coordinated isolated restore for an incompatible/irreversible schema change, reconcile post-capture revocations and pending effects, then validate before reopening traffic. [Local rehearsal](plan/evidence/13-maintenance-rehearsal.md) and [operator procedures](OPERATIONS.md) show the exercised scope and its limits.
