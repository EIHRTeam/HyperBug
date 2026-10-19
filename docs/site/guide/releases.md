# Release notes and compatibility

[Documentation home](../index.md) · [Installation matrix](deployment.md) · [Operations](operations.md)

## Prepared candidate — 2026-10-19

**Prepared but unpublished.** This dated candidate has no public release/tag, registry package, production deployment or documentation publication from this work. The private workspace version remains `0.0.0`. Backend G1 is Not passed, Module 10 is Blocked, global G2 is Not passed and actual-Free 13.G6 remains open.

The product source baseline is `9b78e06`. Release preparation adds deployment input maps, private material provisioning/public-policy checks, audited operator-key integration, coordinated recovery fixtures and completed bilingual reader content. Exact source inputs, lockfile/runtime metadata and artifact hashes are retained in the [release manifest](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/evidence/13-release-manifest.json). It is unsigned local metadata, not a trusted signature or hosted provenance attestation.

## Available candidate behavior

Local journeys cover public project/Issue access, bounded structured search, templates and Issue Forms, safe Markdown preview/rendering, direct/multipart uploads, processing/release states, discussion/reactions, assignments/taxonomy, close/reopen and timeline pagination. Staff management covers project settings/forms/templates/roles, redacted audit browsing, account sessions and reviewed plugin configuration/lifecycle. Sensitive operations require current role plus recent verified passkey assurance; browser tokens/drafts remain memory-only.

These features pass recorded local Node/PostgreSQL and native workerd/D1 tiers with a static frontend. The [final candidate evidence](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/evidence/13-release-readiness.md) names each passing, failed, skipped or unrun lane. Earlier manual accessibility acceptance remains at its recorded device/assistive-technology scope; no universal WCAG/device certification is claimed.

## Minimum disclosure and compatibility changes

Minimum is explicitly selected with `cloudflare-minimum` / `minimum-v2`; it is never an automatic fallback. Its disclosed differences are FREE-01 weaker peppered PBKDF2 passwords, FREE-02 approximate per-location shedding plus authoritative D1 controls, FREE-03 bounded D1/Cron durability, FREE-04 shorter logs/no export, FREE-05 capacity limits and title-only search, FREE-06 operator SMTP requirement with current adapter unavailable, FREE-07 seven-day D1 recovery window and independently unproven full recovery objectives, and FREE-08 disabled/capped bulk/long jobs.

The actual new-password policy is PBKDF2-HMAC-SHA256 with mandatory versioned pepper, per-user 16-byte salt, 50,000 new iterations and 100,000 stored maximum. New passwords require 12 Unicode code points, at most 1,024 UTF-8 bytes and bundled common-password rejection; stronger stored records within the ceiling are not reduced. This is weaker offline protection than Argon2id; online controls cannot offset database-plus-pepper compromise. Passkeys are preferred. Standard successful login rehashes PBKDF2 to Argon2id; downgrade cannot verify Argon2id and requires verified recovery preparation.

Object authorization, complete required audit, fail-closed verification, sanitizer/CSP, TLS/HSTS, keyed credential digests, AES-256-GCM envelope encryption and memory-only browser tokens remain non-negotiable. See the [full capability/degradation matrix](deployment.md) and [Free runbook](deploy-cloudflare.md). Future changes to this list, password policy or actual capabilities must update both reader languages and these notes together.

Search-mode switches require stopping old dispatchers and bounded rebuilding; Minimum titles-only cursors from the retired policy fail and must be restarted. Existing SQL histories remain immutable (36 D1 / 33 PostgreSQL); Module 13 adds no migration. Prior credential-assurance upgrades backfill assurance1 and require a fresh verified passkey for sensitive administration; inspect the target history and upgrade recipient before rollout.

## Known limitations and release blockers

Paid-hosted Cloudflare Standard remains unmeasured; Minimum full-profile CPU/quota/capacity/recovery attribution is incomplete and the prior hosted instance403 remains unexplained. A tiny 1,423 ms D1 bookmark restore and1,068 ms three-byte R2 restore do not establish an instance ceiling, password fit or production RPO/RTO. Billing access is unavailable; Free plan is user-attested. Staging load, production proxy/client-IP/scanner isolation/bridge/update validation and publication require their own authorized environment/action.

The dependency review retains one moderate development-tool advisory in Drizzle’s nested esbuild 0.18.20 (`GHSA-67mh-4wv8-2f99`); its affected development-server capability must not be exposed. No high/critical advisory is reported by the current audit. This is a recorded finding, not an ignore rule or a claim that the dependency is patched. Release evidence records scope and disposition.

SeaweedFS 4.48 is the tested S3-compatible local provider; other S3 versions/services and Workers+PostgreSQL/Hyperdrive are not guaranteed. SMTP/SSO/named integrations, relations, saved views, subscriptions, notifications and bulk/import/export remain later modules. Native plugins are trusted code, not sandboxed extensions. No email-delivery, production throughput or availability promise is made.

## Upgrade and publication decision

Follow [operations](operations.md) and the [concrete release checklist](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/RELEASE-CHECKLIST.md): verify exact artifacts/environment/migrations/backups/keys, distinguish application rollback from schema recovery, retain current revocations and perform authenticated smoke checks. Frontend config/generated headers publish together and previews pair with isolated staging. Production and GitHub Pages remain unpublished until separately authorized; a successful local site build is not publication.
