import {
  scanVerifiedUpload,
  UploadIntentError,
  type UploadScanDependencies,
  type UploadIntentRecord,
} from '@hyperbug/application';

export type ScannerPipelineMode =
  | 'clean'
  | 'infected'
  | 'identity'
  | 'timeout'
  | 'commit-denied'
  | 'release-denied'
  | 'project-commit-denied'
  | 'project-release-denied'
  | 'partial';
type Query = (
  sql: string,
  values?: (string | number)[],
) => Promise<Record<string, unknown>[]>;
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
/** Test-only durable proof, starting at the already accepted finalized/quarantined boundary. */
export async function proveScannerPipeline(
  deps: UploadScanDependencies,
  query: Query,
  mode: ScannerPipelineMode,
  bytes: Uint8Array,
  timeoutMs = 50,
) {
  const now = Date.now(),
    projectId = crypto.randomUUID(),
    principalId = crypto.randomUUID(),
    id = crypto.randomUUID();
  await query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [projectId, `actual-scan-${id}`, 'Scanner fixture', now, now],
  );
  await query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Scanner fixture', ?)",
    [principalId, now],
  );
  const suffix = id.replaceAll('-', '').repeat(2);
  const input = {
    id,
    projectId,
    principalId,
    now,
    expiresAt: now + 900000,
    stagingKey: `staging/${suffix}`,
    finalKey: `objects/${suffix}`,
    filename: 'fixture.txt',
    contentType: 'text/plain',
    maxBytes: bytes.length,
    association: { kind: 'issue-draft' as const, draftId: crypto.randomUUID() },
  };
  const digest = deps.createDigest();
  await digest.write(bytes);
  const sha256 = await digest.finish();
  await deps.blobs.put({
    key: input.finalKey,
    size: bytes.length,
    body: new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    createOnly: true,
    contentType: input.contentType,
    metadata: { 'intent-id': id },
  });
  await deps.intents.reserve(input);
  await deps.intents.requestFinalize(input, now);
  const seed = {
    ...input,
    leaseId: crypto.randomUUID(),
    leaseExpiresAt: now + 60000,
  };
  await deps.intents.claim(seed);
  await deps.intents.commitVerified({
    ...seed,
    verified: {
      key: input.finalKey,
      size: bytes.length,
      sha256: mode === 'identity' ? '0'.repeat(64) : sha256,
      contentType: input.contentType,
      providerVersion: null,
      scanStatus: 'unscanned',
    },
  });
  const lease = { ...seed, leaseId: crypto.randomUUID() };
  let checks = 0;
  const commitDenied = mode.endsWith('commit-denied');
  const releaseDenied = mode.endsWith('release-denied');
  const authorize = async () => {
    checks++;
    if (checks === 3) {
      const committed = await deps.intents.get(input);
      assert(
        committed?.scanStatus === 'clean' &&
          committed.policyState === 'quarantined',
        'Release bypassed durable clean quarantine',
      );
    }
    if (checks === (commitDenied ? 2 : releaseDenied ? 3 : -1))
      await query(
        mode.startsWith('project-')
          ? "UPDATE projects SET status = 'archived' WHERE id = ?"
          : "UPDATE principals SET status = 'suspended' WHERE id = ?",
        [mode.startsWith('project-') ? projectId : principalId],
      );
    const rows = await query(
      'SELECT p.status AS principal_status, x.status AS project_status FROM principals p JOIN projects x ON x.id = ? WHERE p.id = ?',
      [projectId, principalId],
    );
    if (
      rows[0]?.principal_status !== 'active' ||
      rows[0]?.project_status !== 'active'
    )
      throw new UploadIntentError('UPLOAD_FORBIDDEN');
  };
  const originalGet = deps.blobs.get.bind(deps.blobs);
  const blobs =
    mode === 'partial'
      ? {
          ...deps.blobs,
          async get(key: string) {
            const object = await originalGet(key);
            if (!object) return null;
            void object.body.cancel().catch(() => {});
            return {
              ...object,
              body: new ReadableStream<Uint8Array>({
                start(c) {
                  c.error(new Error('fixture-stream-failure'));
                },
              }),
            };
          },
        }
      : deps.blobs;
  let denied: string | null = null;
  try {
    await scanVerifiedUpload(
      { ...deps, blobs, ...(mode === 'timeout' ? { timeoutMs } : {}) },
      authorize,
      lease,
    );
  } catch (error) {
    denied = error instanceof UploadIntentError ? error.code : 'unexpected';
  }
  const record = (await deps.intents.get(input))!;
  assert(record, 'Missing durable scan record');
  const expected: Partial<UploadIntentRecord> =
    mode === 'clean'
      ? { scanStatus: 'clean', policyState: 'ready' }
      : mode === 'infected'
        ? { scanStatus: 'infected', policyState: 'rejected' }
        : mode === 'identity'
          ? { scanStatus: 'failed', policyState: 'rejected' }
          : commitDenied
            ? { scanStatus: 'pending', policyState: 'quarantined' }
            : releaseDenied
              ? { scanStatus: 'clean', policyState: 'quarantined' }
              : { scanStatus: 'failed', policyState: 'quarantined' };
  for (const [key, value] of Object.entries(expected))
    assert(
      record[key as keyof UploadIntentRecord] === value,
      `Wrong durable ${mode} ${key}`,
    );
  assert(record.reservationState === 'used', 'Scanner released quota');
  assert(
    record.verified?.sha256 === (mode === 'identity' ? '0'.repeat(64) : sha256),
    'Scanner changed immutable identity',
  );
  assert(
    denied === (mode.endsWith('-denied') ? 'UPLOAD_FORBIDDEN' : null),
    'Wrong authorization result',
  );
  if (mode === 'clean' || mode === 'infected' || releaseDenied) {
    assert(
      record.scan?.evidence?.engine === 'ClamAV' ||
        record.scan?.evidence?.engine === 'synthetic-test-scanner',
      'Missing trusted engine identity',
    );
    assert(
      record.scan?.sha256 === sha256 && record.scan?.sizeBytes === bytes.length,
      'Unbound durable result',
    );
  }
  if (mode === 'identity')
    assert(
      record.scan?.failure === 'identity',
      'Identity failure not retained',
    );
  if (mode === 'timeout')
    assert(record.scan?.failure === 'timeout', 'Timeout not retained');
  for (const [kind, key] of [
    ['project', projectId],
    ['principal', principalId],
  ] as const) {
    const row = (
      await query(
        `SELECT reserved_bytes, used_bytes, reserved_count FROM ${kind}_upload_usage WHERE ${kind}_id = ?`,
        [key],
      )
    )[0]!;
    assert(
      Number(row.reserved_bytes) === 0 &&
        Number(row.used_bytes) === bytes.length &&
        Number(row.reserved_count) === 0,
      'Incorrect durable quota',
    );
  }
  return {
    mode,
    scanStatus: record.scanStatus,
    policyState: record.policyState,
    failure: record.scan?.failure ?? null,
    evidence: record.scan?.evidence ?? null,
    sha256: record.scan?.sha256 ?? null,
    sizeBytes: record.scan?.sizeBytes ?? null,
    usedBytes: bytes.length,
    denied,
    authorizationChecks: checks,
  };
}
