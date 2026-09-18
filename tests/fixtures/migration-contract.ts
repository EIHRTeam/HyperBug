import { expect } from 'vitest';
import type { RepositoryHarness } from './repository-contract.ts';
import { nextId } from './repository-contract.ts';

export async function seedPreviousSchema(harness: RepositoryHarness) {
  const now = 1789689600000;
  const projectId = nextId();
  const principalId = nextId();
  await harness.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [projectId, `upgrade-${projectId}`, 'Upgrade fixture', now, now],
  );
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Upgrade staff', ?)",
    [principalId, now],
  );
  const intent = {
    id: nextId(),
    mutationId: nextId(),
    requestId: nextId(),
    principalId,
    projectId,
    keyHash: 'a'.repeat(64),
    payloadHash: 'b'.repeat(64),
    now,
    expiresAt: now + 86400000,
    title: 'Existing Issue',
    body: 'Existing Unicode content 🌱',
    auditAction: 'issue.created' as const,
  };
  // Frozen 0000 writer fixture: upgrades must not depend on current adapter columns.
  const result = {
    id: intent.id,
    projectId,
    number: 1,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  const outcome = { result, replayed: false };
  await harness.query(
    'UPDATE projects SET next_issue_number = 2 WHERE id = ?',
    [projectId],
  );
  await harness.query(
    'INSERT INTO issues (id, project_id, number, title, body, author_id, created_at, updated_at, last_mutation_id) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)',
    [
      intent.id,
      projectId,
      intent.title,
      intent.body,
      principalId,
      now,
      now,
      intent.mutationId,
    ],
  );
  await harness.query(
    "INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, actor_id, action, created_at, metadata) VALUES (?, ?, ?, 1, ?, 'issue.create', ?, '{}')",
    [intent.mutationId, projectId, intent.id, principalId, now],
  );
  await harness.query(
    "INSERT INTO audit_events (id, project_id, actor_id, action, target_id, result, request_id, created_at, metadata) VALUES (?, ?, ?, 'issue.created', ?, 'success', ?, ?, '{}')",
    [
      intent.mutationId,
      projectId,
      principalId,
      intent.id,
      intent.requestId,
      now,
    ],
  );
  await harness.query(
    "INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES (?, ?, ?, 'issue.create', ?, ?, ?)",
    [
      intent.mutationId,
      projectId,
      intent.id,
      JSON.stringify({ issueId: intent.id, mutationId: intent.mutationId }),
      now,
      now,
    ],
  );
  await harness.query(
    "INSERT INTO mutation_receipts (id, principal_id, project_id, operation, key_hash, payload_hash, result, created_at, expires_at) VALUES (?, ?, ?, 'issue.create', ?, ?, ?, ?, ?)",
    [
      intent.mutationId,
      principalId,
      projectId,
      intent.keyHash,
      intent.payloadHash,
      JSON.stringify(result),
      now,
      intent.expiresAt,
    ],
  );
  const issue = {
    ...result,
    title: intent.title,
    body: intent.body,
    authorId: principalId,
    state: 'open',
    closeReason: null,
    closedAt: null,
    typeId: null,
    milestoneId: null,
    moderation: 'visible',
    deletedAt: null,
  };
  return async () => {
    expect(await harness.repository.getIssue(projectId, intent.id)).toEqual(
      issue,
    );
    expect(await harness.repository.createIssue(intent)).toEqual({
      ...outcome,
      replayed: true,
    });
    for (const table of [
      'timeline_events',
      'audit_events',
      'outbox',
      'mutation_receipts',
    ])
      expect(
        Number(
          (
            await harness.query(
              `SELECT count(*) AS count FROM ${table} WHERE project_id = ?`,
              [projectId],
            )
          )[0]?.count,
        ),
      ).toBe(1);
    const next = await harness.repository.createIssue({
      ...intent,
      id: nextId(),
      mutationId: nextId(),
      keyHash: 'c'.repeat(64),
    });
    expect(next.result.number).toBe(2);
  };
}

export async function verifyRejectedUpgrade(
  harness: RepositoryHarness,
  applyIntegrity: () => Promise<unknown>,
) {
  const verify = await seedPreviousSchema(harness);
  await harness.query(
    "UPDATE issues SET state = 'closed', closed_at = created_at",
  );
  await expect(applyIntegrity()).rejects.toThrow();
  // Failed migration must preserve the old schema and original content for repair.
  expect((await harness.query('SELECT body FROM issues'))[0]?.body).toBe(
    'Existing Unicode content 🌱',
  );
  await harness.query("UPDATE issues SET state = 'open', closed_at = NULL");
  await applyIntegrity();
  return verify;
}
