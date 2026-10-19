import { assertId } from '@hyperbug/domain';
import {
  UploadIntentError,
  type UploadIntentRecord,
  type UploadScope,
} from './upload-intents.ts';

/** Trusted recovery input only; a historical key/version does not prove backend ownership. */
export interface UploadLegacyCandidate extends UploadScope {
  state: UploadIntentRecord['state'];
  revision: number;
  objectKey: string;
  contentType: string;
  maxBytes: number;
  createdAt: number;
  expiresAt: number;
  actualBytes: number | null;
  objectVersion: string | null;
  checksum: string | null;
  hasAttachment: boolean;
}
export interface UploadLegacyInventoryQuery {
  projectId: string;
  limit: number;
  after?: string;
}
export interface UploadLegacyInventoryPage {
  items: UploadLegacyCandidate[];
  /** Includes current intents filtered out after the bounded index window. */
  scanned: number;
  next: string | null;
}
export interface UploadLegacyInventoryStore {
  inspect(
    input: UploadLegacyInventoryQuery,
  ): Promise<UploadLegacyInventoryPage>;
}
export interface UploadLegacyInventoryRow extends UploadLegacyCandidate {
  hasLifecycle: boolean;
}
export function validateUploadLegacyInventoryQuery(
  input: UploadLegacyInventoryQuery,
): void {
  assertId(input.projectId);
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 20)
    throw new UploadIntentError('UPLOAD_INVALID');
  if (input.after !== undefined) assertId(input.after);
}
/** Limit base records first, then classify: even an empty legacy page may have a continuation. */
export function uploadLegacyInventoryPage(
  input: UploadLegacyInventoryQuery,
  rows: UploadLegacyInventoryRow[],
): UploadLegacyInventoryPage {
  const page = rows.slice(0, input.limit);
  return {
    items: page
      .filter((row) => !row.hasLifecycle)
      .map(({ hasLifecycle: _hasLifecycle, ...row }) => row),
    scanned: page.length,
    next: rows.length > input.limit ? page.at(-1)!.id : null,
  };
}
