import type { IssueFormSubmissionIntent } from './index.ts';
import { IssueFormError, type IssueFormDefinition } from './issue-forms.ts';
import type { UploadIntentRecord } from './upload-intents.ts';
import { uploadHasCurrentCleanScan } from './upload-scans.ts';

/** Pure snapshot check after answer validation; adapters must fence it during consumption. */
export function assertIssueFormUpload(
  definition: IssueFormDefinition,
  submission: IssueFormSubmissionIntent,
  upload: UploadIntentRecord | null,
): asserts upload is UploadIntentRecord & {
  verified: NonNullable<UploadIntentRecord['verified']>;
} {
  if (
    !upload ||
    upload.association.kind !== 'issue-draft' ||
    upload.association.draftId !== submission.draftId ||
    upload.policyState !== 'ready' ||
    upload.leaseId !== null ||
    !uploadHasCurrentCleanScan(upload)
  )
    throw new IssueFormError('FORM_ATTACHMENTS_INVALID', 'attachments');
  for (const field of definition.body) {
    if (
      field.type === 'upload' &&
      ((submission.values[field.id] ?? []) as readonly string[]).includes(
        upload.id,
      ) &&
      field.validations.accept &&
      !field.validations.accept
        .split(',')
        .some((extension) => upload.filename.toLowerCase().endsWith(extension))
    )
      throw new IssueFormError('FORM_ATTACHMENTS_INVALID', 'attachments');
  }
}
