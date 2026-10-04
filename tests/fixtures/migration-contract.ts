import { expect } from 'vitest';
import type { RepositoryHarness } from './repository-contract.ts';
import { nextId } from './repository-contract.ts';

/** Captures populated prior history; the additive ledger must change none of it. */
export async function snapshotLegacyRecoveryUpgrade(
  harness: RepositoryHarness,
) {
  const intents = await harness.query(
    'SELECT * FROM upload_intents ORDER BY id',
  );
  const ids = intents.map((row) => String(row.id));
  if (!ids.length)
    throw new Error('Populated upload upgrade fixture is missing');
  const scopes = [
    ['upload_intents', 'id', ids],
    ['upload_intent_details', 'intent_id', ids],
    ['attachments', 'upload_intent_id', ids],
    [
      'project_upload_usage',
      'project_id',
      [...new Set(intents.map((row) => String(row.project_id)))],
    ],
    [
      'principal_upload_usage',
      'principal_id',
      [...new Set(intents.map((row) => String(row.principal_id)))],
    ],
  ] as const;
  const captured: {
    sql: string;
    values: string[];
    rows: Record<string, unknown>[];
  }[] = [];
  for (const [table, key, values] of scopes) {
    const sql = `SELECT * FROM ${table} WHERE ${key} IN (${values.map(() => '?').join(',')}) ORDER BY ${key}`;
    // eslint-disable-next-line no-await-in-loop -- Fixed five populated fixture snapshots.
    captured.push({
      sql,
      values: [...values],
      rows: await harness.query(sql, [...values]),
    });
  }
  return async () => {
    for (const { sql, values, rows } of captured) {
      // eslint-disable-next-line no-await-in-loop -- Fixed five fixture comparisons.
      expect(await harness.query(sql, values)).toEqual(rows);
    }
    expect(
      await harness.query(
        `SELECT * FROM upload_legacy_recoveries WHERE intent_id IN (${ids.map(() => '?').join(',')})`,
        ids,
      ),
    ).toEqual([]);
  };
}

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
    typeId: null,
    milestoneId: null,
    labelIds: [],
    assigneeIds: [],
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
    bodyText: null,
    bodyTextVersion: null,
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

export async function seedTemplateUpgrade(harness: RepositoryHarness) {
  const now = 1789689600000;
  const projectId = nextId();
  const templateId = nextId();
  await harness.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [projectId, `template-upgrade-${projectId}`, 'Template upgrade', now, now],
  );
  await harness.query(
    'INSERT INTO issue_templates (id, project_id, name, body, enabled, revision) VALUES (?, ?, ?, ?, 0, 7)',
    [templateId, projectId, 'Legacy template', 'Existing **template** 🌱'],
  );
  return async () => {
    expect(
      (
        await harness.query(
          'SELECT version, name, body, enabled, created_at FROM issue_template_versions WHERE project_id = ? AND template_id = ?',
          [projectId, templateId],
        )
      ).map((row) => ({ ...row, created_at: Number(row.created_at) })),
    ).toEqual([
      {
        version: 7,
        name: 'Legacy template',
        body: 'Existing **template** 🌱',
        enabled: 0,
        created_at: 0,
      },
    ]);
    await expect(
      harness.query(
        'UPDATE issue_template_versions SET body = ? WHERE template_id = ?',
        ['replacement', templateId],
      ),
    ).rejects.toThrow('append-only');
    await expect(
      harness.query(
        'INSERT INTO issue_template_versions (project_id, template_id, version, name, body, enabled, created_at) VALUES (?, ?, 7, ?, ?, 1, ?) ON CONFLICT(project_id, template_id, version) DO UPDATE SET body = excluded.body',
        [projectId, templateId, 'Replacement', 'overwrite', now],
      ),
    ).rejects.toThrow('append-only');
  };
}

export async function seedUploadUpgrade(harness: RepositoryHarness) {
  const project = crypto.randomUUID(),
    principal = crypto.randomUUID(),
    pending = crypto.randomUUID(),
    finalized = crypto.randomUUID();
  const now = 1791000000000;
  await harness.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [project, `upload-upgrade-${project}`, 'Upload upgrade', now, now],
  );
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Legacy uploader', ?)",
    [principal, now],
  );
  await harness.query(
    "INSERT INTO upload_intents (id, project_id, principal_id, object_key, media_type, max_bytes, created_at, expires_at) VALUES (?, ?, ?, ?, 'application/octet-stream', 4, ?, ?)",
    [pending, project, principal, `legacy-${pending}`, now, now + 1000],
  );
  await harness.query(
    "INSERT INTO upload_intents (id, project_id, principal_id, object_key, media_type, max_bytes, created_at, expires_at, state, verified_object_version, verified_checksum, actual_bytes) VALUES (?, ?, ?, ?, 'application/octet-stream', 4, ?, ?, 'finalized', 'v1', 'legacy-checksum', 3)",
    [finalized, project, principal, `legacy-${finalized}`, now, now + 1000],
  );
  return async () => {
    for (const kind of ['project', 'principal']) {
      const row = (
        await harness.query(
          `SELECT reserved_bytes, used_bytes, reserved_count FROM ${kind}_upload_usage WHERE ${kind}_id = ?`,
          [kind === 'project' ? project : principal],
        )
      )[0]!;
      expect([
        Number(row.reserved_bytes),
        Number(row.used_bytes),
        Number(row.reserved_count),
      ]).toEqual([4, 3, 1]);
    }
    expect(
      (
        await harness.query(
          'SELECT state, object_key, actual_bytes FROM upload_intents WHERE id = ?',
          [finalized],
        )
      )[0],
    ).toMatchObject({ state: 'finalized', object_key: `legacy-${finalized}` });
    expect(
      await harness.query(
        'SELECT intent_id FROM upload_intent_details WHERE project_id = ?',
        [project],
      ),
    ).toEqual([]);
    expect(
      await harness.query(
        'SELECT intent_id FROM upload_multipart_sessions WHERE project_id = ?',
        [project],
      ),
    ).toEqual([]);
  };
}
export async function seedScanUpgrade(harness: RepositoryHarness) {
  const project = crypto.randomUUID(),
    principal = crypto.randomUUID(),
    id = crypto.randomUUID();
  const now = 1791000000000,
    sha = 'a'.repeat(64),
    key = id.replaceAll('-', '').repeat(2);
  await harness.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [project, `scan-upgrade-${project}`, 'Scan upgrade', now, now],
  );
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Scan upgrade', ?)",
    [principal, now],
  );
  await harness.query(
    "INSERT INTO upload_intents (id, project_id, principal_id, object_key, media_type, max_bytes, created_at, expires_at, state, verified_object_version, verified_checksum, actual_bytes) VALUES (?, ?, ?, ?, 'application/octet-stream', 4, ?, ?, 'finalized', ?, ?, 3)",
    [
      id,
      project,
      principal,
      `staging/${key}`,
      now,
      now + 60000,
      `sha256:${sha}`,
      sha,
    ],
  );
  await harness.query(
    "INSERT INTO upload_intent_details (intent_id, project_id, filename, final_key, association_kind, draft_id, reservation_state, scan_status, policy_state) VALUES (?, ?, 'fixture.bin', ?, 'issue-draft', ?, 'used', 'clean', 'ready')",
    [id, project, `objects/${key}`, crypto.randomUUID()],
  );
  await harness.query(
    'INSERT INTO project_upload_usage (project_id, used_bytes) VALUES (?, 3)',
    [project],
  );
  await harness.query(
    'INSERT INTO principal_upload_usage (principal_id, used_bytes) VALUES (?, 3)',
    [principal],
  );
  return async () => {
    expect(
      (
        await harness.query(
          'SELECT policy_state, scan_status FROM upload_intent_details WHERE intent_id = ?',
          [id],
        )
      )[0],
    ).toEqual({ policy_state: 'quarantined', scan_status: 'unscanned' });
    expect(
      (
        await harness.query(
          'SELECT state, verified_checksum, actual_bytes, revision FROM upload_intents WHERE id = ?',
          [id],
        )
      )[0],
    ).toMatchObject({
      state: 'finalized',
      verified_checksum: sha,
      revision: 2,
    });
    expect(
      await harness.query(
        'SELECT intent_id FROM upload_scan_results WHERE intent_id = ?',
        [id],
      ),
    ).toEqual([]);
    for (const [kind, scope] of [
      ['project', project],
      ['principal', principal],
    ]) {
      const row = (
        await harness.query(
          `SELECT reserved_bytes, used_bytes, reserved_count FROM ${kind}_upload_usage WHERE ${kind}_id = ?`,
          [scope!],
        )
      )[0]!;
      expect([
        Number(row.reserved_bytes),
        Number(row.used_bytes),
        Number(row.reserved_count),
      ]).toEqual([0, 3, 0]);
    }
  };
}
