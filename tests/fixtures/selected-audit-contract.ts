import { expect } from 'vitest';
import {
  normalizeIssueFormDefinition,
  replayFailedTask,
  taskReference,
  type ProjectStore,
  type TaxonomyStore,
  type ContentDefinitionStore,
  type IssueRepository,
  type AsyncStore,
  type AsyncMaintenanceStore,
  type JobStore,
  type PreparedAuditEvent,
  type CreateIssueIntent,
} from '@hyperbug/application';
import { auditEvent } from '../../packages/security/src/index.ts';

/** Shared real-store failure injection for precisely the four resumed audit items. */
export async function selectedAuditContract(
  query: (
    sql: string,
    values?: (string | number)[],
  ) => Promise<Record<string, unknown>[]>,
  stores: {
    projects: ProjectStore;
    taxonomy: TaxonomyStore;
    definitions: ContentDefinitionStore;
    issues: IssueRepository;
    async: AsyncStore & AsyncMaintenanceStore & Omit<JobStore, 'claim'>;
    append: (event: PreparedAuditEvent) => Promise<void>;
  },
  dialect: 'd1' | 'postgres',
) {
  const actorId = crypto.randomUUID(),
    projectId = crypto.randomUUID(),
    now = Date.now();
  await query(
    "INSERT INTO principals (id,kind,display_name,created_at) VALUES (?,'staff','Audit manager',?)",
    [actorId, now],
  );
  const event = (
    action: string,
    targetId: string,
    metadata: PreparedAuditEvent['metadata'] = {},
  ) =>
    auditEvent({
      id: crypto.randomUUID(),
      projectId,
      actorId,
      systemActor: null,
      action,
      targetId,
      result: 'success',
      requestId: crypto.randomUUID(),
      createdAt: now,
      metadata,
    });
  const duplicate = event('project.created', projectId);
  // A deployment event has no FK on this not-yet-created project.
  await stores.append({
    ...duplicate,
    projectId: null,
    actorId: null,
    systemActor: 'core.deployment',
    action: 'deployment.enablement',
    targetId: 'cloudflare-minimum',
    metadata: { v: 1, acknowledgement: 'minimum-v2', outcome: 'enabled' },
  });
  const failing = (record: PreparedAuditEvent) => ({
    ...record,
    id: duplicate.id,
  });
  const creation = {
    id: projectId,
    slug: `audit-${projectId}`,
    name: 'Do not log this title',
    visibility: 'public' as const,
    administratorPrincipalId: actorId,
    nowMs: now,
  };
  await expect(
    stores.projects.create(
      creation,
      failing(event('project.created', projectId)),
    ),
  ).rejects.toThrow();
  expect(await stores.projects.load(projectId)).toBeNull();
  expect(
    await query('SELECT principal_id FROM project_roles WHERE project_id=?', [
      projectId,
    ]),
  ).toEqual([]);
  expect(
    await stores.projects.create(creation, event('project.created', projectId)),
  ).toBe('created');
  const secondId = crypto.randomUUID();
  expect(
    await stores.projects.create(
      { ...creation, id: secondId },
      { ...event('project.created', secondId), projectId: secondId },
    ),
  ).toBe('slug-conflict');
  expect(await stores.projects.load(secondId)).toBeNull();
  const configuration = {
    id: projectId,
    expectedRevision: 1,
    name: 'Private new name',
    visibility: null,
    nowMs: now,
  };
  await expect(
    stores.projects.configure(
      configuration,
      failing(event('project.configured', projectId)),
    ),
  ).rejects.toThrow();
  expect((await stores.projects.load(projectId))?.revision).toBe(1);
  expect(
    (
      await stores.projects.configure(
        configuration,
        event('project.configured', projectId),
      )
    ).outcome,
  ).toBe('configured');
  expect(
    (
      await stores.projects.configure(
        configuration,
        failing(event('project.configured', projectId)),
      )
    ).outcome,
  ).toBe('conflict');

  const labelId = crypto.randomUUID(),
    typeId = crypto.randomUUID(),
    milestoneId = crypto.randomUUID();
  const taxonomies = [
    {
      id: labelId,
      action: 'label',
      create: (audit: PreparedAuditEvent) =>
        stores.taxonomy.createLabel(
          { id: labelId, projectId, name: 'Bug', description: '', color: '' },
          audit,
        ),
      update: (audit: PreparedAuditEvent) =>
        stores.taxonomy.updateLabel(
          {
            id: labelId,
            projectId,
            expectedRevision: 1,
            name: 'Changed',
            description: null,
            color: null,
          },
          audit,
        ),
      remove: (audit: PreparedAuditEvent) =>
        stores.taxonomy.deleteLabel(projectId, labelId, audit),
      table: 'labels',
    },
    {
      id: typeId,
      action: 'issue-type',
      create: (audit: PreparedAuditEvent) =>
        stores.taxonomy.createIssueType(
          {
            id: typeId,
            projectId,
            name: 'Bug',
            description: '',
            icon: '',
            color: '',
            enabled: true,
            position: 0,
          },
          audit,
        ),
      update: (audit: PreparedAuditEvent) =>
        stores.taxonomy.updateIssueType(
          {
            id: typeId,
            projectId,
            expectedRevision: 1,
            name: null,
            description: null,
            icon: null,
            color: null,
            enabled: false,
            position: null,
          },
          audit,
        ),
      remove: (audit: PreparedAuditEvent) =>
        stores.taxonomy.deleteIssueType(projectId, typeId, audit),
      table: 'issue_types',
    },
    {
      id: milestoneId,
      action: 'milestone',
      create: (audit: PreparedAuditEvent) =>
        stores.taxonomy.createMilestone(
          {
            id: milestoneId,
            projectId,
            title: 'Release',
            description: '',
            dueDate: null,
            nowMs: now,
          },
          audit,
        ),
      update: (audit: PreparedAuditEvent) =>
        stores.taxonomy.updateMilestone(
          {
            id: milestoneId,
            projectId,
            expectedRevision: 1,
            title: null,
            description: null,
            dueDate: undefined,
            state: 'closed',
            nowMs: now,
          },
          audit,
        ),
      remove: (audit: PreparedAuditEvent) =>
        stores.taxonomy.deleteMilestone(projectId, milestoneId, audit),
      table: 'milestones',
    },
  ];
  for (const t of taxonomies) {
    await expect(
      t.create(failing(event(`${t.action}.created`, t.id))),
    ).rejects.toThrow();
    expect(await query(`SELECT id FROM ${t.table} WHERE id=?`, [t.id])).toEqual(
      [],
    );
    expect(await t.create(event(`${t.action}.created`, t.id))).toBe('created');
    await expect(
      t.update(failing(event(`${t.action}.updated`, t.id))),
    ).rejects.toThrow();
    expect(
      Number(
        (await query(`SELECT revision FROM ${t.table} WHERE id=?`, [t.id]))[0]!
          .revision,
      ),
    ).toBe(1);
    expect((await t.update(event(`${t.action}.updated`, t.id))).outcome).toBe(
      'written',
    );
    expect(
      (await t.update(failing(event(`${t.action}.updated`, t.id)))).outcome,
    ).toBe('conflict');
    await expect(
      t.remove(failing(event(`${t.action}.deleted`, t.id))),
    ).rejects.toThrow();
    expect(
      await query(`SELECT id FROM ${t.table} WHERE id=?`, [t.id]),
    ).toHaveLength(1);
    expect(await t.remove(event(`${t.action}.deleted`, t.id))).toBe('deleted');
    expect(await t.remove(failing(event(`${t.action}.deleted`, t.id)))).toBe(
      'not-found',
    );
  }
  const form = normalizeIssueFormDefinition({
    name: 'Report',
    description: 'Private description',
    body: [{ type: 'input', id: 'details', attributes: { label: 'Details' } }],
  });
  for (const kind of ['form', 'template'] as const) {
    const id = crypto.randomUUID();
    const input = { id, projectId, expectedRevision: null, enabled: true, now };
    const save = (revision: number | null, audit: PreparedAuditEvent) =>
      kind === 'form'
        ? stores.definitions.saveForm(
            { ...input, expectedRevision: revision, definition: form },
            audit,
          )
        : stores.definitions.saveTemplate(
            {
              ...input,
              expectedRevision: revision,
              name: 'Template',
              body: 'Private Markdown',
            },
            audit,
          );
    const e = (version: number) =>
      event(`${kind}.saved`, id, { v: 1, version, enabled: 1 });
    await expect(save(null, failing(e(1)))).rejects.toThrow();
    expect(
      await query(`SELECT id FROM issue_${kind}s WHERE id=?`, [id]),
    ).toEqual([]);
    expect((await save(null, e(1))).version).toBe(1);
    await expect(save(1, failing(e(2)))).rejects.toThrow();
    expect(
      Number(
        (
          await query(`SELECT revision FROM issue_${kind}s WHERE id=?`, [id])
        )[0]!.revision,
      ),
    ).toBe(1);
    expect(
      await query(
        `SELECT version FROM issue_${kind}_versions WHERE ${kind}_id=?`,
        [id],
      ),
    ).toHaveLength(1);
    expect((await save(1, e(2))).version).toBe(2);
    await expect(save(1, failing(e(2)))).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
  }

  const issueId = crypto.randomUUID();
  const identity = () => ({
    mutationId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    principalId: actorId,
    projectId,
    keyHash: crypto.randomUUID().replaceAll('-', '').padEnd(64, '0'),
    payloadHash: 'b'.repeat(64),
    now,
    expiresAt: now + 86400000,
  });
  const create: CreateIssueIntent = {
    ...identity(),
    id: issueId,
    title: 'Private issue title',
    body: 'Private body',
    typeId: null,
    milestoneId: null,
    labelIds: [],
    assigneeIds: [],
  };
  const failed = { ...create, mutationId: duplicate.id };
  const before = (await stores.projects.load(projectId))!.nextIssueNumber;
  await expect(stores.issues.createIssue(failed)).rejects.toThrow();
  expect(await stores.issues.getIssue(projectId, issueId)).toBeNull();
  expect((await stores.projects.load(projectId))!.nextIssueNumber).toBe(before);
  const created = await stores.issues.createIssue(create);
  expect((await stores.issues.createIssue(create)).replayed).toBe(true);
  let revision = created.result.revision;
  // New non-noop values for each relation setter.
  const label = crypto.randomUUID(),
    type = crypto.randomUUID(),
    milestone = crypto.randomUUID();
  await stores.taxonomy.createLabel(
    { id: label, projectId, name: 'Triage', description: '', color: '' },
    event('label.created', label),
  );
  await stores.taxonomy.createIssueType(
    {
      id: type,
      projectId,
      name: 'Feature',
      description: '',
      icon: '',
      color: '',
      position: 0,
      enabled: true,
    },
    event('issue-type.created', type),
  );
  await stores.taxonomy.createMilestone(
    {
      id: milestone,
      projectId,
      title: 'Next',
      description: '',
      dueDate: null,
      nowMs: now,
    },
    event('milestone.created', milestone),
  );
  const operations = [
    {
      action: 'issue.edited',
      run: (mutationId: string) =>
        stores.issues.editIssue({
          ...identity(),
          mutationId,
          id: issueId,
          expectedRevision: revision,
          title: 'Changed',
          body: 'Changed',
        }),
    },
    {
      action: 'issue.closed',
      run: (mutationId: string) =>
        stores.issues.closeIssue({
          ...identity(),
          mutationId,
          id: issueId,
          expectedRevision: revision,
          reason: 'completed',
        }),
    },
    {
      action: 'issue.reopened',
      run: (mutationId: string) =>
        stores.issues.reopenIssue({
          ...identity(),
          mutationId,
          id: issueId,
          expectedRevision: revision,
        }),
    },
    {
      action: 'issue.labels',
      run: (mutationId: string) =>
        stores.issues.setIssueLabels({
          ...identity(),
          mutationId,
          id: issueId,
          expectedRevision: revision,
          labelIds: [label],
        }),
    },
    {
      action: 'issue.assignees',
      run: (mutationId: string) =>
        stores.issues.setIssueAssignees({
          ...identity(),
          mutationId,
          id: issueId,
          expectedRevision: revision,
          assigneeIds: [actorId],
        }),
    },
    {
      action: 'issue.type',
      run: (mutationId: string) =>
        stores.issues.setIssueType({
          ...identity(),
          mutationId,
          id: issueId,
          expectedRevision: revision,
          typeId: type,
        }),
    },
    {
      action: 'issue.milestone',
      run: (mutationId: string) =>
        stores.issues.setIssueMilestone({
          ...identity(),
          mutationId,
          id: issueId,
          expectedRevision: revision,
          milestoneId: milestone,
        }),
    },
  ];
  for (const operation of operations) {
    await expect(operation.run(duplicate.id)).rejects.toThrow();
    expect((await stores.issues.getIssue(projectId, issueId))!.revision).toBe(
      revision,
    );
    const mutationId = crypto.randomUUID();
    revision = (await operation.run(mutationId)).result.revision;
    for (const table of [
      'timeline_events',
      'audit_events',
      'outbox',
      'mutation_receipts',
    ])
      expect(
        await query(`SELECT id FROM ${table} WHERE id=?`, [mutationId]),
      ).toHaveLength(1);
    expect(
      (
        await query('SELECT action FROM audit_events WHERE id=?', [mutationId])
      )[0]!.action,
    ).toBe(operation.action);
  }
  const auditsBeforeNoop = await query(
    'SELECT id FROM audit_events WHERE target_id=?',
    [issueId],
  );
  const noop = {
    ...identity(),
    id: issueId,
    expectedRevision: revision,
    labelIds: [label],
  };
  expect((await stores.issues.setIssueLabels(noop)).result.revision).toBe(
    revision,
  );
  expect(
    await query('SELECT id FROM audit_events WHERE target_id=?', [issueId]),
  ).toEqual(auditsBeforeNoop);

  const ref = taskReference('core', create.mutationId);
  await stores.async.claim(now, 'selected-audit', 10);
  expect(await stores.async.begin(ref, 'selected-worker', now)).toBe(
    'acquired',
  );
  await stores.async.fail(ref, 'selected-worker', now + 1, 'unsupported');
  const replay = {
    ...event('async.replayed', ref.eventId, { v: 1, source: 'core' }),
    createdAt: now + 2,
  };
  await expect(
    stores.async.replay(ref, now + 2, failing(replay)),
  ).rejects.toThrow();
  expect(
    (
      await query('SELECT state FROM async_deliveries WHERE event_id=?', [
        ref.eventId,
      ])
    )[0]!.state,
  ).toBe('failed');
  await expect(
    replayFailedTask({
      store: stores.async,
      reference: ref,
      now: now + 2,
      actorId,
      requestId: crypto.randomUUID(),
      authorize: async () => false,
    }),
  ).rejects.toThrow();
  expect(
    await replayFailedTask({
      store: stores.async,
      reference: ref,
      now: now + 2,
      actorId,
      requestId: crypto.randomUUID(),
      authorize: async () => true,
    }),
  ).toBe(true);
  expect(await stores.async.replay(ref, now + 2, failing(replay))).toBe(false);
  await stores.async.begin(ref, 'after-replay', now + 3);
  await stores.async.fail(ref, 'after-replay', now + 4, 'unsupported');

  const jobId = crypto.randomUUID();
  await stores.async.create(jobId, 1, now);
  await stores.async.cancel(jobId, now + 1);
  // A required retention append failure rolls back source retirement, job steps and metadata.
  if (dialect === 'd1') {
    await query(
      "CREATE TRIGGER fail_selected_retention BEFORE INSERT ON audit_events WHEN NEW.action='retention.purged' BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END",
    );
  } else {
    await query(
      "CREATE FUNCTION fail_selected_retention_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='retention.purged' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$",
    );
    await query(
      'CREATE TRIGGER fail_selected_retention BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_selected_retention_fn()',
    );
  }
  await expect(stores.async.purgeTerminal(now + 10, 100)).rejects.toThrow();
  expect(
    (
      await query('SELECT delivered_at FROM outbox WHERE id=?', [ref.eventId])
    )[0]!.delivered_at,
  ).toBeNull();
  expect(
    await query('SELECT delivery_id FROM async_deliveries WHERE event_id=?', [
      ref.eventId,
    ]),
  ).toHaveLength(1);
  await expect(stores.async.purgeJobs(now + 10, 10)).rejects.toThrow();
  expect(await stores.async.get(jobId)).not.toBeNull();
  await query(
    dialect === 'd1'
      ? 'DROP TRIGGER fail_selected_retention'
      : 'DROP TRIGGER fail_selected_retention ON audit_events',
  );
  expect(await stores.async.purgeTerminal(now + 10, 100)).toBeGreaterThan(0);
  expect(await stores.async.purgeJobs(now + 10, 10)).toBe(1);
  expect(await stores.async.purgeJobs(now + 10, 10)).toBe(0);
  expect(
    await query(
      "SELECT id FROM audit_events WHERE action='retention.purged' AND target_id='async-jobs'",
    ),
  ).toHaveLength(1);
  const records = await query(
    'SELECT metadata FROM audit_events WHERE project_id=?',
    [projectId],
  );
  expect(JSON.stringify(records)).not.toMatch(/Private|Do not log/);
  await expect(
    stores.projects.archive(
      { id: projectId, expectedRevision: 2, nowMs: now },
      failing(event('project.archived', projectId)),
    ),
  ).rejects.toThrow();
  expect((await stores.projects.load(projectId))?.status).toBe('active');
  expect(
    (
      await stores.projects.archive(
        { id: projectId, expectedRevision: 2, nowMs: now },
        event('project.archived', projectId),
      )
    ).outcome,
  ).toBe('archived');
}
