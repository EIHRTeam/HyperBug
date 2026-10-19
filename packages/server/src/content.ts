import {
  contentPolicyVersion,
  deriveMarkdownTree,
  markdownRepresentationEtag,
} from '@hyperbug/security/markdown';
import type { CommentRecord } from '@hyperbug/application';
import { commentView } from '@hyperbug/application';

/** Only invoke after current object visibility/authorization is established. */
export function contentRepresentation(
  id: string,
  revision: number,
  body: string,
) {
  return {
    bodyTree: deriveMarkdownTree(body),
    contentPolicyVersion,
    representationEtag: markdownRepresentationEtag(id, revision, 'tree'),
  };
}
export function storedPreview(text: string | null): string | null {
  return text === null ? null : [...text].slice(0, 280).join('');
}
export function commentContentView(
  record: CommentRecord,
  includeBody: boolean,
) {
  const visible = record.moderation === 'visible' && record.deletedAt === null;
  return {
    ...commentView(record, includeBody),
    preview: visible ? storedPreview(record.bodyText) : null,
    textProjectionVersion: visible ? record.bodyTextVersion : null,
    ...(visible && includeBody
      ? contentRepresentation(record.id, record.revision, record.body)
      : {}),
  };
}
