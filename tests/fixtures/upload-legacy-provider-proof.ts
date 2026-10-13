import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListMultipartUploadsCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import {
  createS3LegacyRecoveryProvider,
  type S3LegacyRecoveryConfig,
  type S3LegacyRecoveryApproval,
} from '@hyperbug/blob-s3';
import {
  uploadLegacyRecoveryVersion,
  uploadLegacyRecoveryAccounting,
} from '@hyperbug/application';

export type LegacyProviderConfig = S3LegacyRecoveryConfig;
export function legacyProviderApproval(
  config: LegacyProviderConfig,
  key = `historical prefix/文件 ${crypto.randomUUID()}`,
  expiresAt = Date.now() - 600000,
): S3LegacyRecoveryApproval {
  const now = Date.now();
  const snapshot = {
    id: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    principalId: crypto.randomUUID(),
    state: 'pending' as const,
    revision: 1,
    objectKey: key,
    contentType: 'text/plain',
    maxBytes: 4,
    createdAt: now - 900000,
    expiresAt,
    actualBytes: null,
    objectVersion: null,
    checksum: null,
    hasAttachment: false,
  };
  const decision: S3LegacyRecoveryApproval['decision'] = {
    version: uploadLegacyRecoveryVersion,
    decisionId: crypto.randomUUID(),
    snapshot,
    retainAfterExpiryMs: 300000,
    ownershipEvidenceSha256: 'a'.repeat(64),
    accountingEvidenceSha256: 'b'.repeat(64),
  };
  const ownershipEvidence = new TextEncoder().encode(
    JSON.stringify({
      version: 's3-legacy-ownership-1',
      endpoint: config.endpoint,
      bucket: config.bucket,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      multipartContinuation: config.multipartContinuation ?? 's3',
      snapshot,
    }),
  );
  const accountingEvidence = new TextEncoder().encode(
    JSON.stringify({
      version: 's3-legacy-accounting-1',
      snapshot,
      retained: uploadLegacyRecoveryAccounting(decision),
    }),
  );
  decision.ownershipEvidenceSha256 = createHash('sha256')
    .update(ownershipEvidence)
    .digest('hex');
  decision.accountingEvidenceSha256 = createHash('sha256')
    .update(accountingEvidence)
    .digest('hex');
  return { decision, ownershipEvidence, accountingEvidence };
}

/** Actual provider bytes/sessions; accounting is an explicit test manifest, not production provenance. */
export async function proveLegacyProviderRecovery(
  config: LegacyProviderConfig,
  refusal = false,
) {
  const approval = legacyProviderApproval(config);
  const key = approval.decision.snapshot.objectKey,
    sibling = `${key}-preserved`;
  const client = new S3Client({
    ...config,
    maxAttempts: 1,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const adapter = createS3LegacyRecoveryProvider(config, approval);
  const sessions: { key: string; id: string }[] = [];
  const makeSession = async (target: string) => {
    const result = await client.send(
      new CreateMultipartUploadCommand({ Bucket: config.bucket, Key: target }),
    );
    if (!result.UploadId) throw new Error('Missing test session');
    sessions.push({ key: target, id: result.UploadId });
  };
  const head = (target: string) =>
    client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: target }));
  const recover = () =>
    adapter.provider.recover({
      decision: approval.decision,
      signal: AbortSignal.timeout(30000),
    });
  try {
    for (const target of [key, sibling])
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: target,
          Body: 'old',
          ContentType: 'text/plain',
        }),
      );
    for (let i = 0; i < (refusal ? 1 : 21); i++) await makeSession(key);
    await makeSession(sibling);
    if (refusal) {
      await expect(recover()).rejects.toMatchObject({
        code: 'UPLOAD_UNAVAILABLE',
      });
      expect((await head(key)).ContentLength).toBe(3);
      const remaining = await client.send(
        new ListMultipartUploadsCommand({
          Bucket: config.bucket,
          Prefix: key,
          MaxUploads: 20,
        }),
      );
      expect(remaining.Uploads?.filter((row) => row.Key === key).length).toBe(
        1,
      );
      expect(
        remaining.Uploads?.filter((row) => row.Key === sibling).length,
      ).toBe(1);
      // R2 discovery can return another opaque token for the same session.
      // Prove original create tokens remain writable instead of comparing encodings.
      for (const session of sessions)
        expect(
          (
            await client.send(
              new UploadPartCommand({
                Bucket: config.bucket,
                Key: session.key,
                UploadId: session.id,
                PartNumber: 1,
                Body: 'x',
              }),
            )
          ).ETag,
        ).toBeTruthy();
    } else {
      expect(await recover()).toEqual({
        decisionId: approval.decision.decisionId,
        ownershipEvidenceSha256: approval.decision.ownershipEvidenceSha256,
        key,
        remainingObjects: 0,
        remainingUploads: 0,
      });
      await expect(head(key)).rejects.toMatchObject({
        $metadata: { httpStatusCode: 404 },
      });
      const remaining = await client.send(
        new ListMultipartUploadsCommand({
          Bucket: config.bucket,
          Prefix: key,
          MaxUploads: 20,
        }),
      );
      expect(remaining.Uploads?.length).toBe(1);
      expect(remaining.Uploads?.every((row) => row.Key === sibling)).toBe(true);
      // Retained decisions remain safe to repeat after late physical creation.
      await client.send(
        new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: 'old' }),
      );
      await makeSession(key);
      expect((await recover()).remainingUploads).toBe(0);
      await expect(head(key)).rejects.toMatchObject({
        $metadata: { httpStatusCode: 404 },
      });
    }
    expect((await head(sibling)).ContentLength).toBe(3);
    const preserved = sessions.find((session) => session.key === sibling)!;
    expect(
      (
        await client.send(
          new UploadPartCommand({
            Bucket: config.bucket,
            Key: sibling,
            UploadId: preserved.id,
            PartNumber: 1,
            Body: 'x',
          }),
        )
      ).ETag,
    ).toBeTruthy();
  } finally {
    adapter.close();
    const failures: unknown[] = [];
    for (const session of sessions) {
      try {
        await client.send(
          new AbortMultipartUploadCommand({
            Bucket: config.bucket,
            Key: session.key,
            UploadId: session.id,
          }),
        );
      } catch (error) {
        if (!(error instanceof Error && error.name === 'NoSuchUpload'))
          failures.push('abort');
      }
    }
    for (const target of [key, sibling]) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: target }),
        );
      } catch {
        failures.push('delete');
      }
    }
    for (const target of [key, sibling]) {
      try {
        await expect(head(target)).rejects.toMatchObject({
          $metadata: { httpStatusCode: 404 },
        });
        const remaining = await client.send(
          new ListMultipartUploadsCommand({
            Bucket: config.bucket,
            Prefix: target,
            MaxUploads: 20,
          }),
        );
        if (remaining.IsTruncated || remaining.Uploads?.length)
          failures.push('remaining sessions');
      } catch {
        failures.push('absence');
      }
    }
    client.destroy();
    if (failures.length) {
      // eslint-disable-next-line no-unsafe-finally -- Cleanup failure must prevent actual-provider acceptance.
      throw new Error(
        'Owned legacy test cleanup incomplete; no credentials exposed',
      );
    }
  }
}
