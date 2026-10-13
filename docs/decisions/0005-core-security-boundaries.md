# ADR 0005: Core security policy and HTTP boundaries

- Date: 2026-09-19
- Status: Accepted for the first module 03 increment
- Owners: 03.1a–03.1d, 03.3b; 03.3f policy only
- Sources: SECURITY §§3–6, 27, 35–43, 62–67, 110–116, 129–134, 146–147, 154–159; existing API permission matrix

## Context

The dual-runtime foundation already provided explicit origins in configuration, bounded body bytes, safe generic errors and request correlation. Origins were not yet enforced, parsed JSON/query complexity was not bounded, and no reusable current-object permission evaluator existed. Module 03 must establish these controls before any identity or product writes.

## Decision

Use the shared server boundary to enforce exact configured origins and explicit preflights without business cookies. Preserve no-Origin protocol clients and require later authentication/object authorization independently. Keep every current response no-store. No wildcard, preview-domain shortcut or new credential storage/trust origin is introduced.

Keep deployment security configuration in the existing config leaf package, pure authorization/data-classification contracts in the security leaf, and allowlisted diagnostic serialization in observability. No infrastructure or framework type enters the permission contract. Validate and freeze bounds/retention at startup; supplied invalid values fail startup. Production and staging reject debug.

Require server-loaded facts bound to the exact actor/action/project/object. Anonymous permission is limited to explicit public reads. Staff grants stay project-scoped and cannot turn User into Staff. Sensitive administration requires administrator, verified assurance >=2, and recent authentication (default five minutes, maximum fifteen). This tightens a SHOULD within the existing baseline; it does not introduce a login ceremony. Credential/identity/ceremony mappings and transactional integration remain module 04/feature work. Fail closed on provider failure and bound provider work with abort/deadline; do not cache authorization decisions.

Serialize only catalogued error codes/messages and allowlisted diagnostic enums/identifiers. Retain seven independent retention settings, with future controlled cleanup rather than deletion on configuration load. Credential crypto, password algorithms/key providers and audit persistence are deliberately not implied by these policy objects.

## Alternatives and consequences

A CORS plugin's automatic reflection/defaults would still require explicit server-side Origin rejection and both-runtime lifecycle tests. Small shared hooks make the required policy visible without another dependency. Returning provider/framework messages or recursively redacting arbitrary objects would admit unknown credential locations; fixed output fields avoid that exposure.

A single global retention interval cannot represent the independent privacy, audit and credential-lifecycle purposes. A single role check cannot express object/project binding or preserve public/User/Staff boundaries. Returning stale cached authorization on provider outage would weaken SECURITY §158 and is rejected.

Native plugins remain trusted code and resolvers must cooperate with abort; no in-process wrapper is claimed to sandbox malicious code. Configurable input limits are ceilings, not substitutes for route schemas or feature cost limits. Temporary fixture routes remain outside deployed artifacts.

## Verification and review

[Evidence and focused security review](../plan/evidence/03-security-foundation-validation.md) records Node/workerd results, failures, corrections and limits. [Security foundation specification](../SECURITY-FOUNDATION.md) defines settings, binding/assurance semantics, cache/retention behavior and downstream handoffs. Complete module 03 and module 10 acceptance are still required before claiming a secure product/backend or starting the SPA.
