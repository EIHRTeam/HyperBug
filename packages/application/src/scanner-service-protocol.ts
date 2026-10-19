import { assertId } from '@hyperbug/domain';
import { assertBlobSize, assertBlobType } from './blob-store.ts';
import { validateScanOutcome, type ScanOutcome } from './upload-scans.ts';

export const scannerServiceProtocol = 'attachment-scanner-1';
export const scannerServiceUrl =
  'https://attachment-scanner.invalid/internal/attachment-scan/v1';
export const scannerServiceMaxBytes = 32 * 1024 ** 2;
export const scannerServiceReplyMaxBytes = 2048;
export interface ScannerServiceIdentity {
  sizeBytes: number;
  sha256: string;
}
export interface ScannerServiceReply {
  protocol: typeof scannerServiceProtocol;
  requestId: string;
  identity: ScannerServiceIdentity | null;
  outcome: ScanOutcome;
}
export function validateScannerServiceSecret(value: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
    throw new Error('Invalid scanner service configuration');
}
export function validateScannerServiceInput(input: {
  requestId: string;
  sizeBytes: number;
  contentType: string;
}) {
  assertId(input.requestId);
  assertBlobSize(input.sizeBytes);
  assertBlobType(input.contentType);
  if (input.sizeBytes > scannerServiceMaxBytes)
    throw new Error('Invalid scanner service input');
}
export function validateScannerServiceReply(
  value: unknown,
): ScannerServiceReply {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      'identity,outcome,protocol,requestId'
  )
    throw new Error();
  const reply = value as ScannerServiceReply;
  if (reply.protocol !== scannerServiceProtocol) throw new Error();
  assertId(reply.requestId);
  validateScanOutcome(reply.outcome);
  if (reply.outcome.status === 'failed') {
    if (reply.identity !== null) throw new Error();
  } else {
    const identity = reply.identity;
    if (
      !identity ||
      typeof identity !== 'object' ||
      Object.keys(identity).sort().join(',') !== 'sha256,sizeBytes' ||
      typeof identity.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(identity.sha256)
    )
      throw new Error();
    assertBlobSize(identity.sizeBytes);
    if (identity.sizeBytes > scannerServiceMaxBytes) throw new Error();
  }
  return reply;
}
