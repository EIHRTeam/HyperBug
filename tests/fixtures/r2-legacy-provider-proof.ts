import {
  createR2LegacyRecoveryProvider,
  type R2LegacyRecoveryApproval,
  type R2SigningConfig,
} from '@hyperbug/blob-r2';
import {
  uploadLegacyRecoveryVersion,
  uploadLegacyRecoveryAccounting,
  type UploadLegacyCandidate,
} from '@hyperbug/application';

export async function r2LegacyApproval(
  config: R2SigningConfig,
  key = `historical prefix/文件 ${crypto.randomUUID()} ?#%+&`,
  expiresAt = Date.now() - 600000,
): Promise<R2LegacyRecoveryApproval> {
  const snapshot = {
    id: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    principalId: crypto.randomUUID(),
    state: 'pending' as const,
    revision: 1,
    objectKey: key,
    contentType: 'text/plain',
    maxBytes: 4,
    createdAt: Date.now() - 900000,
    expiresAt,
    actualBytes: null,
    objectVersion: null,
    checksum: null,
    hasAttachment: false,
  };
  return r2LegacySnapshotApproval(config, snapshot);
}
/** Fresh test record only; the caller separately proves owned physical data and seeded accounting. */
export async function r2LegacySnapshotApproval(
  config: R2SigningConfig,
  snapshot: UploadLegacyCandidate,
): Promise<R2LegacyRecoveryApproval> {
  const decision: R2LegacyRecoveryApproval['decision'] = {
    version: uploadLegacyRecoveryVersion,
    decisionId: crypto.randomUUID(),
    snapshot,
    retainAfterExpiryMs: 300000,
    ownershipEvidenceSha256: 'a'.repeat(64),
    accountingEvidenceSha256: 'b'.repeat(64),
  };
  const ownershipEvidence = new TextEncoder().encode(
    JSON.stringify({
      version: 'r2-legacy-ownership-1',
      accountId: config.accountId,
      bucket: config.bucket,
      absencePolicy: 'r2-direct-delete-head-1',
      snapshot,
    }),
  );
  const accountingEvidence = new TextEncoder().encode(
    JSON.stringify({
      version: 'r2-legacy-accounting-1',
      snapshot,
      retained: uploadLegacyRecoveryAccounting(decision),
    }),
  );
  const digest = async (bytes: Uint8Array) =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice())),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
  [decision.ownershipEvidenceSha256, decision.accountingEvidenceSha256] =
    await Promise.all([digest(ownershipEvidence), digest(accountingEvidence)]);
  return { decision, ownershipEvidence, accountingEvidence };
}
/** Test setup/observation ports; receives only this proof's freshly created owned keys. */
export interface R2LegacyFixturePort {
  put(key: string): Promise<void>;
  head(key: string): Promise<boolean>;
  create(key: string): Promise<string>;
  writable(key: string, id: string): Promise<boolean>;
  abort(key: string, id: string): Promise<void>;
  delete(key: string): Promise<void>;
}
/** Same actual provider proof from Node/S3 and workerd/native binding; no production provenance. */
export async function proveR2LegacyRecovery(
  config: R2SigningConfig,
  port: R2LegacyFixturePort,
  ownedFixtureKey?: string,
) {
  const approval = await r2LegacyApproval(config, ownedFixtureKey);
  const key = approval.decision.snapshot.objectKey,
    sibling = `${key}-preserved`;
  const adapter = await createR2LegacyRecoveryProvider(config, approval);
  const sessions: { key: string; id: string }[] = [];
  const make = async (target: string) => {
    const id = await port.create(target);
    sessions.push({ key: target, id });
    return id;
  };
  const recover = () =>
    adapter.provider.recover({
      decision: approval.decision,
      signal: AbortSignal.timeout(30000),
    });
  const check = (condition: boolean) => {
    if (!condition)
      throw new Error(
        'Owned R2 legacy proof failed; private provider details withheld',
      );
  };
  try {
    await port.put(key);
    await port.put(sibling);
    for (let i = 0; i < 21; i++) await make(key);
    const other = await make(sibling);
    const proof = await recover();
    check(
      proof.key === key &&
        proof.decisionId === approval.decision.decisionId &&
        proof.remainingObjects === 0 &&
        proof.remainingUploads === 0,
    );
    check(!(await port.head(key)));
    check(await port.head(sibling));
    check(!(await port.writable(key, sessions[0]!.id)));
    check(!(await port.writable(key, sessions[20]!.id)));
    check(await port.writable(sibling, other));
    await port.put(key);
    const late = await make(key);
    check((await recover()).remainingObjects === 0);
    check(!(await port.head(key)));
    check(!(await port.writable(key, late)));
    check(await port.head(sibling));
    check(await port.writable(sibling, other));
    return { targetSessions: 21, siblingPreserved: true, lateReswept: true };
  } finally {
    try {
      for (const session of sessions) await port.abort(session.key, session.id);
      for (const target of [key, sibling]) await port.delete(target);
      check(!(await port.head(key)));
      check(!(await port.head(sibling)));
      check((await recover()).remainingUploads === 0);
      check(
        !(await port.writable(
          sibling,
          sessions.find((session) => session.key === sibling)!.id,
        )),
      );
    } finally {
      adapter.close();
    }
  }
}
