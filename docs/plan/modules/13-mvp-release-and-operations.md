# 13 — MVP release, deployment, and maintenance readiness

Phase: MVP release gate  
Prerequisites: 12 complete and backend gate 10 remains passing.  
Progress: [Session log and current status](../progress/13-mvp-release-and-operations.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Make the MVP installable, upgradeable, observable, and recoverable in both official deployment profiles, with a separately deployable static frontend.

Reader documentation starts at the [documentation index](../../README.md). Its current outlines are preparation for 13.3d, not completed publication or exercised runbooks.

The optional Cloudflare Free minimum tier is packaged and accepted here through 13.1f–13.1g, 13.2g, 13.3f and the independent gate 13.G6, under [ADR 0007](../../decisions/0007-cloudflare-free-minimum-tier.md) and [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md). It is never part of G1 or G2 and is never cited as MVP acceptance.

## Ordered checklist

### Step 13.1 — Package supported deployments

- [ ] **13.1a** Provide Cloudflare templates/runbooks for Workers, D1, R2, Queues, Workflows, bindings/secrets, exact CORS, media isolation, and Cloudflare Pages static hosting.
- [ ] **13.1b** Provide self-host packaging/runbooks for Node 24, PostgreSQL 18.x, a tested S3-compatible provider, Graphile Worker, reverse-proxy TLS where used, and graceful worker shutdown.
- [ ] **13.1c** Document independent frontend/backend releases, `config.json`, SPA fallback, preview-to-staging pairing, CSP/header generation, and cache rules for Pages plus a generic static server.
- [ ] **13.1d** Publish the tested S3 provider/version/feature matrix; leave Workers + PostgreSQL/Hyperdrive outside guaranteed profiles unless separately verified.
- [ ] **13.1e** Provide safe initial-admin setup, account recovery, key provisioning/rotation, plugin trust guidance, resource quotas, and production configuration validation.
- [ ] **13.1f** Provide the minimum tier's packaging and runbook: Cloudflare Free setup, the tier and acknowledgement configuration, quota budgets and alerting, the no-Logpush observability substitute, SMTP relay configuration, the measured instance ceiling, and the downgrade pre-check that migrates or resets Argon2id password records before the tier is enabled.
- [ ] **13.1g** Publish the tier capability and degradation matrix alongside the tested provider/version matrix (13.1d), including what the tier cannot do, what changes after an upgrade to Workers Paid, and the dated provider facts the tier relies on.

### Step 13.2 — Rehearse maintenance and recovery

- [ ] **13.2a** Test fresh installation and upgrade from a recorded prior schema/build for both profiles, including a compatible rolling sequence and failed-migration recovery.
- [ ] **13.2b** Back up and restore database records, blobs, configuration, and required encryption-key versions; verify cross-resource consistency and attachment integrity after restore.
- [ ] **13.2c** Rehearse application rollback separately from data-schema rollback; use forward fixes/restore for irreversible migrations and document recovery objectives based on the rehearsal.
- [ ] **13.2d** Exercise key compromise/revocation, role revocation, DLQ replay, search rebuild, retention cleanup, and provider outage procedures.
- [ ] **13.2e** Publish logs/metrics/traces dashboards or equivalent operator queries, alerts for queue lag/failures/errors, and measured performance/cost baselines.
- [ ] **13.2f** Update the maintenance guidance with actual commands and operational lessons; remove placeholder instructions that no longer match the implementation.
- [ ] **13.2g** Rehearse operations under the minimum tier's limits (7-day D1 Time Travel, 24-hour message retention, bounded logging, no log export) and record measured recovery objectives and limitations for that tier instead of inheriting the standard-profile objectives.

### Step 13.3 — Validate and prepare release artifacts

- [ ] **13.3a** Run required unit/integration/contract/security/browser/migration/storage/plugin suites on the final candidate and archive evidence.
- [ ] **13.3b** Run bounded load/abuse scenarios in authorized staging with authentication/authorization enabled; compare both profiles and frontend bundles against established budgets.
- [ ] **13.3c** Review dependency/install-script/secret/license findings, produce artifact hashes and reproducible build metadata, and add provenance/signing where supported.
- [ ] **13.3d** Publish English and Simplified Chinese setup, API, extension, troubleshooting, security-reporting, upgrade, backup/restore, and release-note documentation through the VitePress site on GitHub Pages. Document limitations and unverified provider combinations honestly.
- [ ] **13.3e** Prepare a concrete release checklist with environment, artifacts, migrations, rollback, and smoke checks. Perform production publishing only within actual session authorization.
- [ ] **13.3f** Publish the mandatory minimum-tier degradation notice: the bilingual reader documentation under `docs/site/guide/` and `docs/site/zh-CN/guide/` states the degradations, the non-negotiable invariants, the compensating controls and the actual password-hash policy, and release notes state when that list or the tier's capabilities change. The engineering disclosure lives in [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); the site statement must not be weaker than it.

## MVP release gate

- [ ] **13.G1** The entire PRODUCT §29 journey works on both official profiles and the static frontend.
- [ ] **13.G2** Security and PERFORMANCE §77 baselines are met, with no unresolved release-blocking issues.
- [ ] **13.G3** Fresh install, upgrade, restore, configuration validation, and operator recovery instructions have been exercised.
- [ ] **13.G4** Evidence, English docs, supported-version matrix, release artifacts, and every affected session log are current.
- [ ] **13.G5** Record the release outcome or prepared-but-unpublished state explicitly; do not mark publication complete merely because artifacts are ready.
- [ ] **13.G6** Independent minimum-tier acceptance: the tier's checklist and evidence pass on an actual Cloudflare Free account, with the measured password parameters, the quota-aware measurements, the disclosure notice in both reader languages, and the recorded recovery objectives. This gate is independent of 13.G1–13.G5: it never opens, closes or substitutes for G1/G2, and missing Free-plan access keeps it open rather than accepting emulation.

## Source coverage

PRODUCT §29; TECH-STACK §§6–8, 47–53; ARCHITECTURE §§8–11, 43–49; SECURITY §§124–161; PERFORMANCE §§58–80.
See [ADR 0007](../../decisions/0007-cloudflare-free-minimum-tier.md) and [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md) for the minimum-tier packaging, matrix, rehearsal and disclosure owned by 13.1f–13.1g, 13.2g, 13.3f and 13.G6.

