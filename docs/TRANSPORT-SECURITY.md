# Transport security and platform capability verification

Owner: [03.2f](plan/modules/03-security-foundation.md). Sources: SECURITY §§50, 82–88 and 156. Last documentation lookup and local verification: 2026-09-21. This document defines the verification procedure and records local capability; it does not certify a deployed endpoint.

## Termination boundaries

| Profile / segment | TLS owner | Evidence required for a deployment claim |
| --- | --- | --- |
| Visitor → Cloudflare frontend/API edge | Cloudflare and the connecting client | Actual hostname handshake, verified certificate chain/hostname, protocol, cipher and negotiated group |
| Cloudflare internal services / managed bindings | Provider | Dated product-specific documentation; mark unobservable handshake details unknown |
| Cloudflare → an independently hosted origin, if used | Cloudflare plus the origin TLS terminator | Actual origin-side handshake observations and certificate validation policy, separately from the visitor connection |
| Visitor → self-hosted API/frontend | Operator's reverse proxy or TLS terminator | Proxy/library versions, effective settings and observed handshake at each public hostname |
| Reverse proxy → Node | Operator | Document a restricted same-host socket/loopback hop, or verify TLS and peer identity separately for a network hop |
| Application → database, object storage or external provider | Each adapter and destination | Independently verified transport and trust settings; incoming-edge TLS says nothing about these connections |

The static frontend and public API are independently hosted: check both origins. Node's current entry point serves HTTP on loopback by default and implements no TLS terminator. Both production roots currently expose foundation health behavior only. Local HTTP/workerd tests do not prove production HTTPS, HSTS, proxy isolation or outbound TLS. Do not expose the Node HTTP listener on an untrusted network. Accept forwarded transport/client metadata only from a deliberately trusted proxy; a caller-supplied header cannot establish HTTPS or peer identity.

Production domains should use HTTPS and HSTS. Configure and verify HSTS at the actual HTTPS owner, including redirects and error responses; enable `includeSubDomains` or preload only after checking every affected subdomain (SECURITY §50). Keep TLS 1.3 and platform hybrid key agreement available. This work does not change deployed minimum protocol settings; the local fixture requires TLS 1.3 to isolate that capability.

## Distinguish encryption, key agreement and authentication

Record these independently:

- **Protocol:** for example TLS 1.3. Its availability alone does not prove a hybrid handshake.
- **Symmetric cipher:** for example `TLS_AES_256_GCM_SHA384`. The TLS 1.3 cipher suite does not identify the key agreement or certificate signature.
- **Key agreement:** prefer platform `X25519MLKEM768` where both peers support it. A successful classical `X25519` fallback must be disclosed as classical for that connection.
- **Authentication:** record the leaf public-key algorithm, certificate-chain signature algorithms, peer-verification result and, when observable, the TLS handshake signature algorithm. These are distinct; a leaf certificate's issuer signature is not proof of the handshake signature or every certificate in the chain.

AES-256 data encryption, an ML-KEM-capable runtime, or a hybrid visitor handshake does not imply post-quantum authentication across the application path. Use platform implementations only. New application signature/cipher algorithms require the existing ADR process; this capability document introduces none.

## Cloudflare findings as of 2026-09-21

The current [PQC overview](https://developers.cloudflare.com/ssl/post-quantum-cryptography/) documents TLS 1.3 hybrid agreement for supporting visitors. `X25519MLKEM768` (`0x11ec`) is recommended; `X25519Kyber768Draft00` (`0x6399`) is obsolete. Actual selection still depends on the client and connection. Visitor-to-edge and internal post-quantum signature authentication remain under development.

The current [origin documentation](https://developers.cloudflare.com/ssl/post-quantum-cryptography/pqc-to-origin/) says Automatic key exchange is enabled on existing zones and by default on new ones. It learns a preference across the zone, prefers hybrid when supported, and continues advertising other allowed groups. A HelloRetryRequest may select another group. **The old Origin Post-Quantum Encryption API is now a no-op**; its `preferred`/`supported` requests are not effective configuration evidence. Inspect Automatic key exchange and applicable compliance settings, then verify the actual connection.

Since mid-2026, the same documentation describes ML-DSA support for origin-facing Authenticated Origin Pulls (AOP) and Custom Origin Trust Store (COTS). This is a capability of the edge↔origin segment. AOP authenticates Cloudflare to the origin; COTS validates the origin to Cloudflare under Full (strict). A post-quantum authentication claim requires the verifying side to reject classical certificates as well as using an appropriate chain and signature; merely presenting ML-DSA is insufficient. COTS replaces the zone's default publicly trusted CAs, so it must not be enabled as an incidental change. None of these features was configured or tested in this session.

Cloudflare Tunnel supports hybrid key agreement, but its authentication signatures are not yet post-quantum according to the same source. Provider-internal claims remain documented capabilities unless separately observed. No Cloudflare account, deployed hostname or origin was probed for this batch.

## Repeatable verification

### Local Node capability

From the repository root, run the existing tool with Node 24 and an installed OpenSSL CLI:

```sh
node tooling/transport-probe.mjs
```

The script creates a one-day, RSA-2048 localhost certificate in a private temporary directory and uses `node:tls` on loopback. It explicitly trusts that test certificate, checks the hostname, keeps certificate verification enabled, and bounds each handshake to four seconds. It removes the temporary certificate/key and clears its owned key buffer on completion; it makes no claim about erasing platform/GC copies. It writes only sanitized algorithm/version/results metadata to ignored `.local/phase03-transport/node-tls-result.json`.

The seven cases are forced hybrid, platform-default group selection, an explicitly classical client, no shared group, wrong hostname, untrusted certificate, and TLS 1.2 against a TLS 1.3-only server. Success includes peer authorization and protocol checks; rejection cases must fail for the expected TLS reason rather than time out. The forced hybrid and classical cases assert their negotiated group. Default group selection is observed rather than assumed stable across library versions.

The [recorded local result](plan/evidence/03-node-transport-capability.json) shows Node 24.21.0 / OpenSSL 3.5.8 selecting `X25519MLKEM768` for both forced and default cases and `X25519` for the classical client. All negative cases reject. Certificate authentication is classical RSA; the probe does not observe the TLS handshake signature directly and proves no post-quantum authentication. The separate certificate-generation CLI is OpenSSL 3.6.4, not Node's linked TLS library.

### Actual deployment acceptance

For each deployed frontend, API and applicable origin segment:

1. Record the deployment/environment, exact authorized hostname, termination owner, client/TLS-library versions and time. Check effective TLS and trust settings at the terminator; distinguish platform capability from configured policy.
2. Use a TLS client with the intended group support. Verify the correct SNI and hostname, certificate validity and trust chain, protocol and negotiated group. Record handshake/chain authentication details separately. Never disable peer verification to obtain a successful result.
3. Try the preferred hybrid group, a supported classical-only client and an incompatible group. Record actual fallback/rejection. Do not label an explicitly allowed classical fallback as a hybrid connection. If an operator requires a stronger policy, verify that incompatible clients fail instead of assuming the preference enforces it.
4. Exercise wrong-hostname, untrusted-chain and disallowed-protocol cases on an isolated test endpoint. Confirm errors deny the connection. Check redirects, HTTPS/HSTS and proxy-to-origin isolation separately; neither a TLS library version nor the local fixture establishes those controls.
5. Observe edge→origin negotiation at the origin or a suitable provider observation surface. A direct client→origin probe proves origin capability only, not what Cloudflare negotiated. Record missing observations as unknown and leave their acceptance open.
6. Repeat after a TLS provider, runtime, proxy, trust-store or policy change and before making a stronger capability claim. Keep these checks within the deployment acceptance owner (modules 10/13); no deployment is created by this document.

## Crypto-agility evidence metadata

Use a versioned verification record (`v: 1`) with `recordedAt`, `scope` (local capability, provider documentation, or deployed observation), deployment tier/profile, segment/termination owner, evidence source, runtime and TLS-library versions, and a policy revision. Policy describes minimum protocol, preferred/allowed groups, classical fallback and trust/authentication requirements. Each observation records protocol, cipher, group, authentication algorithms, verification result and rejection reason; unavailable details are explicitly unknown. The local probe's `policy.v` versions its narrow fixture policy; a deployed record must additionally identify the segment and configuration revision.

Configured policy and observed negotiation must remain separate. A future reporting endpoint must consume deployment evidence; it must not infer negotiated properties from `standard`/`minimum`, `process.versions`, a request header or cloud hosting alone. Keep private keys, certificates containing private identity information, credentials, session material and request bodies out of evidence. Algorithm identifiers and tool versions are sufficient for this local record.

Application credential/envelope records already carry versions, algorithms and key references as specified in [CRYPTOGRAPHY](CRYPTOGRAPHY.md). Transport changes do not rewrite those records or authorize weaker verifiers. Unknown application formats continue to fail closed. Refresh dated provider claims as capabilities evolve; do not install custom PQ primitives to fill an observation gap.

## Lookup and evidence boundaries

Context7 resolve-then-query on 2026-09-21 covered Node (`/websites/nodejs_latest-v24_x_api`), OpenSSL (`/openssl/openssl`) and Cloudflare (`/cloudflare/cloudflare-docs`). [Node TLS documentation](https://nodejs.org/docs/latest-v24.x/api/tls.html) supplied `ecdhCurve`, `getProtocol`, `getCipher`, `getEphemeralKeyInfo`, verified peer handling and protocol bounds. OpenSSL documentation supplied temporary `req -x509` certificate generation. The official Cloudflare pages linked above and their current repository source closed gaps around Automatic key exchange, the no-op API and origin ML-DSA support. Installed-runtime behavior is recorded separately from documentation.

03.2f completes the documentation/capability-verification procedure only. Actual deployed transport, HSTS, proxy trust, managed-service segments and PQ authentication remain unverified. Other Phase 03 acceptance and G1/G2 remain open. Audit work remains [suspended](plan/AUDIT-SUSPENSION.md); this verification records transport behavior and does not resume audit development or Argon2id performance work.
