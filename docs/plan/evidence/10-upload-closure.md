# Module 10 B3 — Upload requirement closure

Date: 2026-10-11. Scope: 07.3c, 07.3f, 07.3h, 07.V4 at the canonical checklist's stated outcomes. No production behavior, public contract, migration or dependency changed. This assessment supersedes older progress entries that made production scanner rollout and operational historical repair prerequisites to implementation closure. Those deployment/recovery limits remain explicit; this is not production scanner or release acceptance.

## Requirement-to-evidence assessment

| ID | Verified outcome and evidence | Remaining operational limit |
| --- | --- | --- |
| 07.3c | 300-second capabilities and post-sign authorization/expiry fences; exact Workers/R2 installed CORS and browser positive/negative slice in [deployed evidence](07-upload-lifecycle-validation.md#deployed-workers-upload-and-cors-2026-10-04). Backend-only Node/AWS signing and streaming in [actual storage evidence](07-storage-validation.md). New actual Node/SeaweedFS installed-policy/browser slice below fills the corresponding S3 gap. | Local Node signer/S3/browser composition is not a deployed Node application; other S3 vendors are untested. CORS grants browser access; signed capability and intent authorization remain required. |
| 07.3f | Quarantine, durable scan result, separate authorized release/reject and truthful unscanned state in [lifecycle evidence](07-upload-lifecycle-validation.md#scanner-hook-continuation--2026-10-03). [Actual signed ClamAV evidence](07-scanner-environment-validation.md#trusted-transport-and-actual-durable-pipeline): 15 adapter checks plus 18 actual durable D1/PostgreSQL journeys (latest migration rerun), including EICAR, clean, timeout, partial/identity mismatch and permission loss. No synthetic verdict is relabelled real. | Production roots do not select an engine. A deployed trusted bridge, physical cancellation, resource/egress/admission isolation and signature update/rotation remain unverified. Files remain quarantined without a configured verified scanner/release. |
| 07.3h | Bounded project/ID cleanup, fenced leases/cursors, orphan/expired/multipart absence before one-time reserved/used quota release, retained-key late-write resweeps: [lifecycle evidence](07-upload-lifecycle-validation.md#explicit-policy-verified-unlinked-cleanup--2026-10-04), shared wait bound and real SeaweedFS/R2 reconciliation/dual-ledger compositions. [Module 09 scheduling evidence](09-completion-audit.md) wires `runScheduledUploadCleanup` in Node `async-processing.ts`, Standard `composition.ts` and Minimum `async-minimum.ts`. Actual-store maintenance fixture checks resume, stale lease rejection, quota and referenced attachment preservation; its provider I/O is synthetic. | Operational historical deletion needs reviewed per-record ownership/accounting and issuer/in-flight quiescence. Do not compact retained keys from prefix inventory or a timeout. Filesystem is development/recovery only. |
| 07.V4 | Case mapping below covers every listed negative and safe cleanup resume using real runtime/database evidence plus distinct actual-provider proofs. | No generalized production historical compaction or deployed scanning claim. |

## 07.V4 explicit case mapping

| Required case | Evidence |
| --- | --- |
| Expired/replayed intents | Both-store reservation conflict/replay; actual expired Workers capability 403; HTTP post-sign expiry/finalized denial; multipart unverified completion replay after expiry rejected, finalized idempotence preserved. [Lifecycle initial and multipart checkpoints](07-upload-lifecycle-validation.md#multipart-continuation-checkpoint--2026-10-03). |
| Wrong-project upload | Shared foreign-project rollback, owner/project scope, multipart receipt/session isolation; D1 repeats permission predicates inside its atomic batch. Same evidence's initial and multipart checkpoints. |
| Quota races | 12-way global principal quota across projects; project quota across principals; eight-way reservation/finalize/accounting/multipart races, one-time conversion/release. [Initial results](07-upload-lifecycle-validation.md#focused-results). |
| Misleading MIME/size | Actual size/type/magic/extension/digest checks; incorrect declared multipart receipt size refused; actual provider short/oversize/SHA256 and promotion proof. [Storage](07-storage-validation.md), [multipart](07-upload-lifecycle-validation.md#multipart-continuation-checkpoint--2026-10-03). |
| Post-finalize overwrite | Both-profile HTTP immutable final bytes after staging overwrite; real SeaweedFS/R2 immutable promotion/create races and crash resume. Signed PUT remains reusable until expiry and is never described as single-use. [Storage](07-storage-validation.md). |
| Safe cleanup resume | Failure retains quota; next cursor/expired lease resumes; late-write tombstone repeats; both ledgers compose actual R2 absence on fresh fixtures. Actual 21-session provider discovery/abort pagination preserves sibling keys. [Dual-ledger evidence](07-upload-lifecycle-validation.md#actual-r2-and-dual-ledger-composition-2026-10-04), [09](09-completion-audit.md). |

## New Node/S3 installed-policy/browser proof

Environment: Node 24.21.0; repository AWS SDK and `createS3BlobStore`; real isolated SeaweedFS 4.48 commit `530be3e37337488ecc34d58441e0bc476e121c93`, Darwin ARM64; Chrome 155.0.0.0 via DevTools MCP isolated context. Two dynamic loopback HTTP origins are minimal protocol fixtures. HTTP is the existing explicit development allowance, not a production TLS claim. No ordinary API file buffering or backend secret was sent to the browser. Only scoped short-lived presigned capabilities were held in browser memory.

Restored the original accepted official [4.48 release](https://github.com/seaweedfs/seaweedfs/releases/tag/4.48) asset to `/tmp/hyperbug-seaweed-4.48`: SHA-256 `faa194e72a346755dc4404288b0561eb3c260351702901d8363024d5099bdd7d`, matches GitHub asset digest. Existing `startSeaweedTestService` provisions an isolated mode-0700 data directory, mode-0600 random backend credentials and dynamic loopback service ports. Command: `CI=true corepack pnpm exec tsx .local/module10/s3-cors.ts` (approved local-socket sandbox exception). Throwaway fixture removed after proof; no test/dependency added.

Installed and read back exactly one bucket rule: AllowedOrigins = the exact positive origin; AllowedMethods = PUT; AllowedHeaders = content-type; ExposeHeaders = ETag; MaxAgeSeconds = 0. Five distinct owned staging keys. `fetch` always uses `credentials: 'omit'`.

| Observation | Actual result |
| --- | --- |
| Positive origin, signed PUT, exact Content-Type | 200; readable ETag; backend HEAD confirms exactly 7 bytes |
| Extra header | Browser rejects; HEAD absent |
| DELETE with PUT capability | Browser rejects; HEAD absent |
| Denied origin on the same service, different port | Browser rejects; HEAD absent |
| Expired one-second capability | 403; HEAD absent |
| Final storage inspection | Only positive object exists; all four negative targets absent |

Initial sandbox invocation failed before execution because tsx could not create its local IPC socket; approved execution succeeded. DevTools file-save was denied by its configured root, so sanitized results were returned inline instead. Process-group SIGINT also stopped Seaweed before graceful HEAD cleanup finished (socket reset); no clean DELETE receipt is claimed. Independent approved process/listener inspection confirms owned processes/listeners absent; exact owned service data directory `hyperbug-s3-sqxmML` was then removed, deleting all isolated storage/credentials. The owned Chrome page closed. No hosted resource or shared bucket policy changed. Temporary source and origin file were removed after recording; binary is disposable test tooling only.

Lookup date 2026-10-11: Context7 resolve/query `/websites/aws_amazon_awsjavascriptsdk_v3` for Put/GetBucketCors commands, and `/seaweedfs/seaweedfs` for [S3 CORS](https://github.com/seaweedfs/seaweedfs/wiki/S3-CORS). Documentation describes rule evaluation and 403 preflight rejection; the exact selected-version compatibility is established by this experiment. modern-web-guidance search/retrieve: `security`, `validate-origins`. Exact URL tuple comparison/allowlist and cookie omission use widely available primitives; the limited-availability Origin API was not introduced. No SPA/accessibility flow or production policy changed.

## Closure decision

All four canonical implementation/negative outcomes are evidenced. Close 07.3c/f/h/V4 at those stated scopes; retain deployment and historical-operation limits above for module 10/release assessment. No operational provenance, synthetic-to-real substitution, scanner deployment, paid acceptance or gate pass is inferred. Reused lanes were not repeated because their code is unchanged.
