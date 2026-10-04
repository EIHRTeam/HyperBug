# ADR 0006: Credential digests, envelope encryption and key lifecycle

- Date: 2026-09-19
- Status: Accepted; both-runtime mechanisms and durable lifecycle locally verified
- Owners: 03.2a–03.2d
- Sources: SECURITY §§68–81, 89–91, 148–150, 154–155

## Decision

Use platform Web Crypto. Opaque credentials contain 32 CSPRNG bytes and persist only a purpose/context-bound HMAC-SHA-256 digest under a dedicated 256-bit token key. Compare MACs with `subtle.verify`, never a JavaScript string comparison. Self-describing records carry version, algorithm, purpose and key reference. Token expiry, one-use behavior and account/session binding remain required module 04 state-machine checks.

Use a new independent CSPRNG AES-256-GCM DEK for each encrypted value/write, with a 96-bit CSPRNG nonce and 128-bit authentication tag. No encryption API accepts a caller-provided DEK/nonce, so a DEK is used to encrypt only one message. Authenticated additional data binds suite/version and the resource type, ID, field, project and data schema version. Context uses a canonical length-unambiguous JSON tuple. Small secret values are bounded; this is not a file/blob encryption protocol.

Wrap DEKs with the source-approved AES-256-KW and an independent 256-bit KEK from a `KeyProvider`. Persist the wrapped DEK, nonce, ciphertext/tag and versioned key reference. Rewrapping changes the KEK wrapper only, retaining the original ciphertext/nonce/context and avoiding plaintext persistence. AAD excludes the mutable KEK reference so rewrapping does not require re-encryption. Successful unwrapping alone does not prove the payload context; decryption/authentication still validates GCM AAD.

Keep token, blind-index and envelope-wrap key purposes separate, including distinct raw key material and protocol/domain separation. Blind indexes accept already-normalized values and a field/project context; identity-specific normalization belongs to module 04. Rotation queries may use bounded current/previous key versions; successful credential verification allows digest migration while old versions remain retained.

The default providers are Worker Secret bindings and a self-hosted permission-restricted secret file/source. No beta Secrets Store dependency is required. Secret JSON never enters ordinary RuntimeConfig, source control, diagnostics or public endpoints. Strict parsing rejects unknown formats, duplicate references/material, invalid purposes/states and weak/malformed key sizes. Key imports are nonextractable except the temporary DEK handle needed for approved wrap/rewrap operations.

Provider access requires an authoritative lifecycle guard: missing or unavailable policy denies use, revoked keys never verify/decrypt, and retained data/backup references prevent removing required key versions. Guard/persistence implementation and atomic reference accounting must be accepted before 03.2d completes. No mutable in-memory flag alone proves emergency revocation across instances. A provider outage never triggers a generated/default key or a previous-key fallback.

## Consequences and alternatives

Per-value DEKs add a 40-byte AES-KW wrapper and avoid shared-DEK nonce coordination across runtimes/instances. Random nonces under a long-lived reused DEK would require an additional uniqueness/usage protocol and are not used here. Native KMS wrap/unwrap remains a future provider option behind the same policy; these initial providers use the explicitly approved local AES-KW mechanism.

Nonrecoverable tokens are not encrypted. Public identifiers, ordinary idempotency hashes and lookup digests are not credentials. No custom AES, SHA, HMAC, Argon2 or PQ primitive is implemented. Password algorithm selection and benchmark evidence require a separate decision; this ADR does not authorize a weaker password hash.

## Durable registry direction (03.2d)

Use an authoritative D1/PostgreSQL registry, with a single generation row that serializes lifecycle changes and protected-record writes. Each operation obtains fresh primary state; D1 uses a new `first-primary` session for its single snapshot query, and PostgreSQL uses the configured primary pool. An optimistic generation precondition aborts an entire D1 batch or PostgreSQL transaction on conflict. No retry may silently substitute a newer administrative decision. This deliberately favors correctness over write throughput; measure the bounded critical section before identity traffic is accepted.

Keep key references as immutable identities with current, previous, revoked and removed states. Removed rows are tombstones and cannot be reused. There is at most one current key per purpose and at most 32 nonremoved versions across the deployment; blind-index activation cannot exceed three readable versions. Revocation may leave a purpose without a current key, which denies cryptographic use until a new version is activated. It never destroys retained material.

Protected records own both the validated versioned cryptographic payload and its referenced key in one row. Creating/replacing a record requires the then-current key and an expected record revision; deletion requires the expected revision. Payload and reference move in the same transaction, including DEK rewrap/digest migration. This avoids separate counters that can drift. Future identity/plugin repositories must use this storage boundary, rather than persisting secret payloads without key accounting.

Backup capture starts by pinning every nonremoved key under a bounded manifest before the database/object snapshot begins. While any capture is open, activation/removal is denied; emergency revocation remains available. Finishing capture preserves the pin through retention. Releasing a retained backup requires expiry and an explicit operator attestation that every copy has been destroyed; elapsed time alone never releases keys. A failed capture stays pinned until an explicit audited cleanup. Actual provider backup/restore orchestration remains module 13 work.

All mutations append a sanitized system audit event in the same transaction. These are internal capabilities for trusted composition/maintenance, with no HTTP endpoint or project-administrator grant. Module 04 owns authenticated deployment-administration entry points and module 03.3a owns audit authorization/retention. Ordinary readers get lifecycle or cryptographic records only, never raw keys. Missing retained material fails closed. Existing migrations remain immutable; the new schema is additive and can be retained during application rollback. Migration 0005 adds the registry and integrity triggers; 0006 adds ordered covering lookups and a partial active-key index after an observed PostgreSQL miss scanned retained rows. One snapshot now uses indexed bounded probes on both databases.

## Acceptance

Current Node/Workers docs list the selected Web Crypto operations. That is a prerequisite, not runtime proof. Require both-runtime known-answer/tamper/wrong-context tests, current/previous rotation and rewrap evidence, emergency revocation and retained-backup/data removal protection. Bound and test parser sizes and provider failures. Record focused security review and measured costs in module 03 evidence before checking items complete.

## Key-material reuse amendment (2026-10-05, approved B7)

Reuse bounded nonextractable imported key objects within a provider instance when the SHA-256 digest of the exact secret document is unchanged. Source reads remain mandatory; changed, malformed, missing or unreadable sources fail closed. Validate the requested purpose against its fresh primary registry snapshot on every independent load; selection reuse is keyed by secret digest and that purpose's validated lifecycle snapshot digest. Retained-key accounting, global registry administration and backup capture continue to inspect the complete registry. Purpose-specific cryptographic loads consult only that purpose's versions and required references.

A request-local provider may share a purpose snapshot inside one original HTTP Request. The next request rereads authoritative lifecycle state, so a revoked or retired key is excluded even when its imported CryptoKey still exists. No lifecycle decision, request I/O, browser credential or revocation flag is cached across requests. Abuse admission similarly shares the pre-parse ring snapshot with authoritative admission only in that request; its source is reread for each independent request.

Cache bounds are one imported secret ring (at most 32 keys; abuse ring at most 8) and at most one validated selection per purpose. Changed documents replace the cache; rejected imports are not retained as a permissive fallback. No raw-key serialization is logged or stored in diagnostics. This is material reuse, not a change to cipher, key separation, retention, authentication or revocation policy. Focused both-runtime provider/revocation evidence belongs to the B7 remediation record; local results do not establish real-Free CPU budgets.
