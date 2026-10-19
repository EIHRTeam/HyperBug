# Module 12 local upload and isolated media acceptance

Date: 2026-10-18. Scope: 12.2c and upload/media portions of 12.2a/12.V2/12.V5. No hosted backend load, deployment, paid resource, push or merge. G1 remains Not passed, Module 10 Blocked and 13.G6 open.

## Results and limits

The production SPA passes **11 Node checks**, **10 Standard checks** and **10 Minimum checks** in [Node](12-upload-node.json), [Standard](12-upload-standard.json) and [Minimum](12-upload-minimum.json). Chrome 155.0.8059.80 uses the existing Playwright runtime because the Browser plugin/skill is unavailable.

Node runs actual PostgreSQL 18.6, the Node adapter and a new genuine local SeaweedFS 4.48 S3 service. Its existing launcher uses disposable credentials/data, loopback-only ports and disabled telemetry/admin surfaces. Exact canonical CORS is installed using PutBucketCors, read back using GetBucketCors and validated before browser use. This is an actual local selected-service browser CORS proof, not a deployed S3/R2 policy or another S3 provider's acceptance.

Standard and Minimum run native workerd, D1, native R2 CRUD/multipart/digests and the production scanner-service client through a private authenticated streaming binding to the actual local Node scanner. Their browser transfer targets Miniflare's S3-compatible endpoint using a **test-only loopback SigV4 signer**. Miniflare supplies wildcard development CORS and cannot implement PutBucketCors. These runs prove the client/native-store/process/scan/media journey; they do **not** prove production R2 bucket policy or account-endpoint signing. The existing Module 07 actual R2 signing/browser evidence remains separate and is not counted as a new rerun. No production adapter endpoint or policy was relaxed for local testing.

Media uses a different hostname, `media.hyperbug.test`, mapped to loopback only by the test Chrome resolver rule. The temporary local TLS certificate has a browser-scoped ephemeral SPKI pin. System DNS, hosts, trust/keychain and certificates are unchanged; production TLS acceptance is unclaimed. File bytes stream through the media bridge with backpressure. No API or authorization cookie route exists on the isolated media surface.

## Actual scanner evidence

The original Module 07 snapshot is preserved. Its daily database dated October 3 fails the unchanged 48-hour freshness bound. One private official freshclam update completed with exit 0 and a successful load test; no daemon/global configuration was installed. A new immutable snapshot independently passes the existing scanner constructor's executable/certificate pins, all detached signature checks, exact database set, freshness and asset fencing. Identity: **ClamAV 1.5.4; daily 28157, main 63, bytecode 339**. Freshclam's certificate-store export emitted the previously observed `NULL X509 store` diagnostics, but its load test and independent signed-file verification passed; verification was never disabled.

Ignored private updater/snapshot paths are `.local/12-scanner-refresh/` and `snapshot/config.json` below it. The snapshot deliberately expires under its normal policy. The SeaweedFS executable was restored only under `/tmp` after its official release archive SHA-256 matched `faa194e72a346755dc4404288b0561eb3c260351702901d8363024d5099bdd7d`; no repository dependency or system install changed.

## Verified journeys

- Direct PUT reports native progress. An expired returned capability is rejected locally and renewed once. On genuine SeaweedFS, a deliberately corrupted signature produces an actual 403 and the unchanged direct transfer renews once.
- A 9 MiB multipart file renews an expired first-part capability, uploads/acknowledges the first part, cancels while part two is blocked, resumes the same reservation and skips the acknowledged first part. Finalization, immutable verification and an actual clean scan separately precede release.
- The browser observes awaiting-processing and quarantined/unscanned states. Actual scanning releases clean PNG/HTML/text, keeps an encrypted benign ZIP quarantined with a partial/failed outcome, and rejects the official EICAR test bytes as infected. Invalid PNG magic is rejected by immutable verification.
- Issue Form submission consumes only released attachments. Server-derived ordinary attachment links and image references both use the same authorized isolated control. Raster preview decodes the real PNG. Downloaded bytes match the source exactly.
- HTML cannot be raster-previewed. SPA download and direct authenticated media navigation produce downloads and never execute its script. Successful media responses force octet-stream, attachment disposition, nosniff and `sandbox; default-src 'none'`; only released raster media exposes the optional preview type.
- An expired owned reservation is explained and retry allocates a fresh ID. The fixture backdates only its disposable record to exercise expiration; it does not alter real clocks, counters or production data. Empty files are rejected before transfer. Sixteen actual store reservations exhaust the unchanged principal quota; the browser receives actionable quota copy.
- Storage requests contain no Authorization or Cookie header. Credentials/signed URLs remain in memory and are absent from reports, which retain only redacted paths. No persistent browser credential or app CSP violation is observed.

All automated runs close their owned browser/listeners, database, storage processes/data and private files. Screenshots are outside the repository at `/tmp/hyperbug12-upload-PROFILE-{raster,multipart}.png`. A separate explicitly held manual fixture is described in Module 12 progress and must be closed after human verification; it is not an automated acceptance result.

## Commands and research

Build the SPA and existing fixture targets first. Then run:

```sh
HYPERBUG_TEST_SEAWEED=/absolute/path/to/verified/weed \
HYPERBUG_TEST_SCANNER_CONFIG_FILE=/absolute/private/current/snapshot/config.json \
node tooling/postgres-test-cluster.mjs node --import tsx \
  tests/fixtures/web-product-local.ts --profile=node --uploads
```

For Standard/Minimum use `--profile=standard`/`minimum` and the current scanner variable; SeaweedFS is not used in those lanes. `--manual` selects a separate headful preparation/hold flow instead of consuming the automated persona token budget. It performs no manual acceptance or automatic passing assertion on human behavior.

Context7 resolve/query on 2026-10-18: ClamAV `/websites/clamav_net`; Workers `/cloudflare/workers-sdk` after direct Miniflare resolution found no library; AWS SDK `/aws/aws-sdk-js-v3`. The installed converter/types and focused runtime failures resolved version-specific gaps. Current Workers best practices (October 12 page) and latest published Workers types 5.20261018.1 were fetched for review without changing dependencies; production binding/schema/compatibility settings remain unchanged. The test-only secret and binding exist only in disposable Miniflare options.

Modern-web action search and retrieval used `forms` and `progress-ring`. Native progress, fieldset/legend, associated labels and live status remain within the existing baseline. No ring masks, Limited Availability background-clip, custom-property animation, inline handler or new sanitizer was introduced. The older installed skill-version warning is retained; current guide content was retrieved.

## Issues corrected during acceptance

The first emulator attempt correctly failed unsupported PutBucketCors, so genuine local SeaweedFS was used for Node instead of adding a permissive proxy. The adapter cannot format an IPv6 listen URL and macOS lacks a `127.0.0.2` alias; the media fixture uses a separate browser-mapped hostname and pinned local TLS, without system changes. Ordinary Issue Form attachment links initially navigated the SPA rather than exposing download controls; the transport adapter now recognizes the canonical attachment path without parsing Markdown. Expiry renewal previously covered only storage 403 for direct PUT; direct/multipart now also renew an expired returned capability. Status reads now clear stale text, prevent simultaneous file changes and cancel across unmount; rejected/unscannable states explain the next action. Initial harness errors (case-sensitive “Download is starting” matching and an incorrect assumption that 9 MiB plain text must fail scanning) were corrected using actual observations and a known encrypted archive fixture.

This is local product acceptance. Module 07 production scanner isolation/update/bridge and deployment/provider remainders, manual accessibility, final focused security/performance review and remaining Module 12 checks stay open.


## Final reconciliation — 2026-10-19

The human 12.V4 matrix, remaining workflow/failure checks, isolated performance and focused review are now complete at the scopes in the [Module 12 completion audit](12-completion.md). Earlier pending statements above are checkpoint history. The local provider/scanner distinctions and all Module 07 production remainders remain unchanged. The manual fixture has stopped; its former URL is obsolete.
