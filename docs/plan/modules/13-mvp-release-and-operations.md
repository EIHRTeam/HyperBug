# 13 — MVP release, deployment, and maintenance readiness

Phase: MVP release gate  
Prerequisites: 12 complete and backend gate 10 remains passing.  
Progress: [Session log and current status](../progress/13-mvp-release-and-operations.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Make the MVP installable, upgradeable, observable, and recoverable in both official deployment profiles, with a separately deployable static frontend.

## Ordered checklist

### Step 13.1 — Package supported deployments

- [ ] **13.1a** Provide Cloudflare templates/runbooks for Workers, D1, R2, Queues, Workflows, bindings/secrets, exact CORS, media isolation, and Cloudflare Pages static hosting.
- [ ] **13.1b** Provide self-host packaging/runbooks for Node 24, PostgreSQL 18.x, a tested S3-compatible provider, Graphile Worker, reverse-proxy TLS where used, and graceful worker shutdown.
- [ ] **13.1c** Document independent frontend/backend releases, `config.json`, SPA fallback, preview-to-staging pairing, CSP/header generation, and cache rules for Pages plus a generic static server.
- [ ] **13.1d** Publish the tested S3 provider/version/feature matrix; leave Workers + PostgreSQL/Hyperdrive outside guaranteed profiles unless separately verified.
- [ ] **13.1e** Provide safe initial-admin setup, account recovery, key provisioning/rotation, plugin trust guidance, resource quotas, and production configuration validation.

### Step 13.2 — Rehearse maintenance and recovery

- [ ] **13.2a** Test fresh installation and upgrade from a recorded prior schema/build for both profiles, including a compatible rolling sequence and failed-migration recovery.
- [ ] **13.2b** Back up and restore database records, blobs, configuration, and required encryption-key versions; verify cross-resource consistency and attachment integrity after restore.
- [ ] **13.2c** Rehearse application rollback separately from data-schema rollback; use forward fixes/restore for irreversible migrations and document recovery objectives based on the rehearsal.
- [ ] **13.2d** Exercise key compromise/revocation, role revocation, DLQ replay, search rebuild, retention cleanup, and provider outage procedures.
- [ ] **13.2e** Publish logs/metrics/traces dashboards or equivalent operator queries, alerts for queue lag/failures/errors, and measured performance/cost baselines.
- [ ] **13.2f** Update the maintenance guidance with actual commands and operational lessons; remove placeholder instructions that no longer match the implementation.

### Step 13.3 — Validate and prepare release artifacts

- [ ] **13.3a** Run required unit/integration/contract/security/browser/migration/storage/plugin suites on the final candidate and archive evidence.
- [ ] **13.3b** Run bounded load/abuse scenarios in authorized staging with authentication/authorization enabled; compare both profiles and frontend bundles against established budgets.
- [ ] **13.3c** Review dependency/install-script/secret/license findings, produce artifact hashes and reproducible build metadata, and add provenance/signing where supported.
- [ ] **13.3d** Publish English setup, API, extension, troubleshooting, security-reporting, upgrade, backup/restore, and release-note documentation. Document limitations and unverified provider combinations honestly.
- [ ] **13.3e** Prepare a concrete release checklist with environment, artifacts, migrations, rollback, and smoke checks. Perform production publishing only within actual session authorization.

## MVP release gate

- [ ] **13.G1** The entire PRODUCT §29 journey works on both official profiles and the static frontend.
- [ ] **13.G2** Security and PERFORMANCE §77 baselines are met, with no unresolved release-blocking issues.
- [ ] **13.G3** Fresh install, upgrade, restore, configuration validation, and operator recovery instructions have been exercised.
- [ ] **13.G4** Evidence, English docs, supported-version matrix, release artifacts, and every affected session log are current.
- [ ] **13.G5** Record the release outcome or prepared-but-unpublished state explicitly; do not mark publication complete merely because artifacts are ready.

## Source coverage

PRODUCT §29; TECH-STACK §§6–8, 47–53; ARCHITECTURE §§8–11, 43–49; SECURITY §§124–161; PERFORMANCE §§58–80.

