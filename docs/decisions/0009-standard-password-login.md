# ADR 0009 — Standard-profile password-login availability

Status: Accepted by explicit user direction on 2026-09-25. Owners: [03.2e/03.V5](../plan/modules/03-security-foundation.md), [04.1d](../plan/modules/04-identity-and-access.md).

## Context

The standard profiles use Argon2id. Shared versioned records and unwired Node/Workers provider candidates exist, but account integration and production composition are unfinished. The user stopped further Argon2id performance testing. The optional Cloudflare Free minimum tier has a distinct PBKDF2 policy, startup gate and acceptance path under [ADR 0007](0007-cloudflare-free-minimum-tier.md).

## Decision

Standard-profile password registration, login and recovery are approved to be opened once their functional account flow and provider implementation are complete. Independent audit may be deferred or run in parallel and must not block Phase 3 development or standard-profile password-login enablement. Further Argon2id performance testing remains stopped under the user's earlier instruction and is also not a prerequisite.

Keep 03.2e and 03.V5 unchecked until their implementation and evidence are actually complete. Their outstanding audit/characterization evidence is not a release gate for standard-profile password login. Preserve the existing Argon2id format and source minimum; this decision does not authorize lowering memory, passes or other password-hash protections. Functional correctness and account integration remain required implementation work.

The optional Cloudflare Free minimum tier is outside this decision. Its password login remains unavailable until its separate PBKDF2 parameter-floor, pepper, account-flow and 13.G6 acceptance requirements pass.

## Consequences

Module 04 may proceed with standard-profile password login without waiting for an independent audit or further performance testing. The plan must not report audit or 03.V5 evidence as complete. Provider deployment suitability and account revision-safe rehash still need implementation as part of the ordinary functional flow. The Free minimum tier remains fail-closed and is not enabled by this ADR.
