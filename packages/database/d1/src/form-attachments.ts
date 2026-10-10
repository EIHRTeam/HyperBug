/* eslint-disable no-await-in-loop -- At most 32 sequential reads keep D1 concurrency bounded. */
import type { D1Database } from '@cloudflare/workers-types';
import {
  assertIssueFormUpload,
  attachmentScanPolicyVersion,
  type CreateIssueIntent,
  type IssueFormDefinition,
} from '@hyperbug/application';
import { readD1UploadIntent } from './upload-intents.ts';

export async function formAttachmentStatements(
  db: D1Database,
  create: CreateIssueIntent,
  definition: IssueFormDefinition,
  ids: readonly string[],
) {
  const statements = [];
  for (const id of ids) {
    const upload = await readD1UploadIntent(db, {
      id,
      projectId: create.projectId,
      principalId: create.principalId,
    });
    assertIssueFormUpload(definition, create.formSubmission!, upload);
    // A scalar NULL witness forces rollback on a zero-row guard. Never use
    // INSERT SELECT alone: zero inserts would commit an attachment-free issue.
    statements.push(
      db
        .prepare(
          `INSERT INTO attachments (id, project_id, upload_intent_id, issue_id, object_key, object_version, checksum, media_type, size_bytes, policy_state, created_at) VALUES (?, ?, ?, ?, (SELECT d.final_key FROM upload_intents i JOIN upload_intent_details d ON d.intent_id = i.id AND d.project_id = i.project_id JOIN upload_scan_results s ON s.intent_id = i.id AND s.project_id = i.project_id WHERE i.id = ? AND i.project_id = ? AND i.principal_id = ? AND i.revision = ? AND i.state = 'finalized' AND i.verified_object_version = ? AND d.association_kind = 'issue-draft' AND d.draft_id = ? AND d.filename = ? AND d.reservation_state = 'used' AND d.policy_state = 'ready' AND d.scan_status = 'clean' AND d.lease_id IS NULL AND s.attempt_id = ? AND s.status = 'clean' AND s.completed_at IS NOT NULL AND s.policy_version = ? AND s.sha256 = i.verified_checksum AND s.size_bytes = i.actual_bytes AND s.evidence = ?), ?, ?, ?, ?, 'ready', ?)`,
        )
        .bind(
          id,
          create.projectId,
          id,
          create.id,
          id,
          create.projectId,
          create.principalId,
          upload.revision,
          `sha256:${upload.verified.sha256}`,
          create.formSubmission!.draftId!,
          upload.filename,
          upload.scan!.attemptId,
          attachmentScanPolicyVersion,
          JSON.stringify(upload.scan!.evidence),
          `sha256:${upload.verified.sha256}`,
          upload.verified.sha256,
          upload.contentType,
          upload.verified.size,
          create.now,
        ),
    );
    statements.push(
      db
        .prepare(
          "UPDATE upload_intent_details SET association_kind = 'issue', draft_id = NULL, issue_id = ? WHERE intent_id = ? AND project_id = ?",
        )
        .bind(create.id, id, create.projectId),
      db
        .prepare(
          'UPDATE upload_intents SET revision = revision + 1 WHERE id = ? AND project_id = ?',
        )
        .bind(id, create.projectId),
    );
  }
  return statements;
}
