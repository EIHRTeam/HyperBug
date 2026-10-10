import { expect, it } from 'vitest';
import {
  normalizeIssueFormDefinition,
  validateIssueFormAnswers,
  attachmentScanPolicyVersion,
  type UploadIntentStore,
  type ReserveUpload,
  type ScanOutcome,
  type ContentDefinitionStore,
  type CreateIssueIntent,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';
import { blobKey } from './blob-store-proof.ts';
import { syntheticClean } from './upload-scan-contract.ts';

export const formUploadQuota = {
  maxFileBytes: 4,
  projectBytes: 100,
  principalBytes: 100,
  projectPending: 40,
  principalPending: 40,
};

const now = 1791000000000;
export function formSubmissionContract(
  get: () => {
    harness: RepositoryHarness;
    store: ContentDefinitionStore;
    uploads: UploadIntentStore;
  },
) {
  const fixture = () => {
    const { harness, store } = get();
    return seedFormSubmissionFixture(harness, store);
  };
  function withFiles(
    f: Awaited<ReturnType<typeof fixture>>,
    ids: string[],
    draftId: string,
  ): CreateIssueIntent {
    const values = { details: 'Canonical **answers**', files: ids };
    return {
      ...f.intent(),
      body: validateIssueFormAnswers(f.definition, values).markdown,
      formSubmission: { formId: f.formId, formVersion: 1, values, draftId },
    };
  }
  it('atomically consumes current clean released draft uploads once and replays after parent association changes', async () => {
    const f = await fixture();
    const upload = await seedFormUpload(get().uploads, f);
    const request = withFiles(f, [upload.id], upload.association.draftId);
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () => {
        return f.harness.repository.createIssue({
          ...request,
          id: nextId(),
          mutationId: nextId(),
          keyHash: nextId().replaceAll('-', '').padEnd(64, '0'),
        });
      }),
    );
    const successes = attempts.filter(
      (
        r,
      ): r is PromiseFulfilledResult<
        Awaited<ReturnType<RepositoryHarness['repository']['createIssue']>>
      > => r.status === 'fulfilled',
    );
    expect(successes).toHaveLength(1);
    expect(
      attempts
        .filter((r) => r.status === 'rejected')
        .every((r) => r.reason.code === 'FORM_ATTACHMENTS_INVALID'),
    ).toBe(true);
    const id = successes[0]!.value.result.id;
    expect(await counts(f.harness, f.projectId)).toEqual({
      issues: 1,
      form_submissions: 1,
      timeline_events: 1,
      outbox: 1,
      mutation_receipts: 1,
    });
    const rows = await f.harness.query(
      'SELECT * FROM attachments WHERE project_id = ?',
      [f.projectId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: upload.id,
      upload_intent_id: upload.id,
      issue_id: id,
      object_key: upload.finalKey,
      object_version: `sha256:${'a'.repeat(64)}`,
      policy_state: 'ready',
    });
    expect(await get().uploads.get(upload)).toMatchObject({
      association: { kind: 'issue', issueId: id },
      reservationState: 'used',
      policyState: 'ready',
    });
    const receipt = (
      await f.harness.query(
        'SELECT key_hash FROM mutation_receipts WHERE project_id = ?',
        [f.projectId],
      )
    )[0]!;
    expect(
      (
        await f.harness.repository.createIssue({
          ...request,
          keyHash: String(receipt.key_hash),
        })
      ).replayed,
    ).toBe(true);
    expect(
      Number(
        (
          await f.harness.query(
            'SELECT used_bytes FROM project_upload_usage WHERE project_id = ?',
            [f.projectId],
          )
        )[0]!.used_bytes,
      ),
    ).toBe(3);
    await f.harness.query(
      "UPDATE issues SET moderation = 'hidden' WHERE id = ?",
      [id],
    );
    await expect(
      get().uploads.mutateScan({
        ...upload,
        leaseId: nextId(),
        leaseExpiresAt: now + 1000,
        kind: 'claim',
        policyVersion: 'new-scan-policy',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
  });
  it('replays identical concurrent form attachment requests after one atomic winner', async () => {
    const f = await fixture();
    const upload = await seedFormUpload(get().uploads, f);
    const request = withFiles(f, [upload.id], upload.association.draftId);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        f.harness.repository.createIssue({
          ...request,
          id: nextId(),
          mutationId: nextId(),
        }),
      ),
    );
    expect(new Set(results.map((result) => result.result.id)).size).toBe(1);
    await f.store.saveForm({
      id: f.formId,
      projectId: f.projectId,
      expectedRevision: 1,
      enabled: false,
      now: now + 1,
      definition: f.definition,
    });
    expect((await f.harness.repository.createIssue(request)).replayed).toBe(
      true,
    );
    expect(await counts(f.harness, f.projectId)).toEqual({
      issues: 1,
      form_submissions: 1,
      timeline_events: 1,
      outbox: 1,
      mutation_receipts: 1,
    });
  });
  it.each([
    'missing-draft',
    'wrong-draft',
    'wrong-owner',
    'wrong-project',
    'pending',
    'unscanned',
    'quarantined',
    'infected',
    'failed',
    'stale-policy',
    'extension',
  ] as const)(
    'rejects %s form attachments without partial effects',
    async (mode) => {
      const f = await fixture();
      let source = f;
      if (mode === 'wrong-owner' || mode === 'wrong-project')
        source = await fixture();
      if (mode === 'wrong-owner')
        source = { ...source, projectId: f.projectId };
      if (mode === 'extension') {
        f.definition = normalizeIssueFormDefinition(
          {
            ...f.definition,
            body: f.definition.body.map((field) =>
              field.type === 'upload'
                ? {
                    ...field,
                    validations: { ...field.validations, accept: '.png' },
                  }
                : field,
            ),
          },
          'canonical',
        );
        await f.store.saveForm({
          id: f.formId,
          projectId: f.projectId,
          expectedRevision: 1,
          enabled: true,
          now,
          definition: f.definition,
        });
      }
      const upload = await seedFormUpload(get().uploads, source, { mode });
      const request = withFiles(
        f,
        [upload.id],
        mode === 'wrong-draft' ? nextId() : upload.association.draftId,
      );
      if (mode === 'missing-draft')
        request.formSubmission = {
          formId: f.formId,
          formVersion: 1,
          values: request.formSubmission!.values,
        };
      if (mode === 'extension')
        request.formSubmission = { ...request.formSubmission!, formVersion: 2 };
      await expect(
        f.harness.repository.createIssue(request),
      ).rejects.toMatchObject({ code: 'FORM_ATTACHMENTS_INVALID' });
      expect(await counts(f.harness, f.projectId)).toEqual({
        issues: 0,
        form_submissions: 0,
        timeline_events: 0,
        outbox: 0,
        mutation_receipts: 0,
      });
      expect(
        await f.harness.query(
          'SELECT id FROM attachments WHERE project_id = ?',
          [f.projectId],
        ),
      ).toEqual([]);
      expect(
        Number(
          (
            await f.harness.query(
              'SELECT next_issue_number FROM projects WHERE id = ?',
              [f.projectId],
            )
          )[0]!.next_issue_number,
        ),
      ).toBe(1);
    },
  );
  it('rolls back earlier attachment consumption when a later attachment is already used', async () => {
    const f = await fixture();
    const first = await seedFormUpload(get().uploads, f);
    const second = await seedFormUpload(get().uploads, f, {
      draftId: first.association.draftId,
    });
    await f.harness.repository.createIssue(
      withFiles(f, [second.id], first.association.draftId),
    );
    await expect(
      f.harness.repository.createIssue(
        withFiles(f, [first.id, second.id], first.association.draftId),
      ),
    ).rejects.toMatchObject({ code: 'FORM_ATTACHMENTS_INVALID' });
    expect(await get().uploads.get(first)).toMatchObject({
      association: first.association,
    });
    expect(
      await f.harness.query(
        'SELECT id FROM attachments WHERE upload_intent_id = ?',
        [first.id],
      ),
    ).toEqual([]);
    expect(await counts(f.harness, f.projectId)).toEqual({
      issues: 1,
      form_submissions: 1,
      timeline_events: 1,
      outbox: 1,
      mutation_receipts: 1,
    });
  });
  it('accepts a bounded 32-file form attachment submission without losing any links', async () => {
    const f = await fixture();
    const files = f.definition.body.find((field) => field.type === 'upload')!;
    f.definition = normalizeIssueFormDefinition(
      {
        ...f.definition,
        body: [...f.definition.body, { ...structuredClone(files), id: 'more' }],
      },
      'canonical',
    );
    await f.store.saveForm({
      id: f.formId,
      projectId: f.projectId,
      expectedRevision: 1,
      enabled: true,
      now,
      definition: f.definition,
    });
    const draftId = nextId(),
      ids: string[] = [];
    for (let index = 0; index < 32; index++)
      ids.push((await seedFormUpload(get().uploads, f, { draftId })).id);
    const values = {
      details: 'Bounded files',
      files: ids.slice(0, 16),
      more: ids.slice(16),
    };
    const request: CreateIssueIntent = {
      ...f.intent(),
      body: validateIssueFormAnswers(f.definition, values).markdown,
      formSubmission: { formId: f.formId, formVersion: 2, values, draftId },
    };
    const result = await f.harness.repository.createIssue(request);
    expect(
      await f.harness.query('SELECT id FROM attachments WHERE issue_id = ?', [
        result.result.id,
      ]),
    ).toHaveLength(32);
    expect(
      Number(
        (
          await f.harness.query(
            'SELECT used_bytes FROM project_upload_usage WHERE project_id = ?',
            [f.projectId],
          )
        )[0]!.used_bytes,
      ),
    ).toBe(96);
    expect((await f.harness.repository.createIssue(request)).replayed).toBe(
      true,
    );
  });
  async function counts(harness: RepositoryHarness, projectId: string) {
    const result: Record<string, number> = {};
    for (const table of [
      'issues',
      'form_submissions',
      'timeline_events',
      'outbox',
      'mutation_receipts',
    ]) {
      result[table] = Number(
        (
          await harness.query(
            `SELECT COUNT(*) AS count FROM ${table} WHERE project_id = ?`,
            [projectId],
          )
        )[0]!.count,
      );
    }
    return result;
  }
  it('commits one replay-safe submission with provenance and rejects spoofed bodies and attachments', async () => {
    const { harness, store, projectId, formId, definition, intent } =
      await fixture();
    const request = intent();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        harness.repository.createIssue({
          ...request,
          id: nextId(),
          mutationId: nextId(),
          requestId: nextId(),
        }),
      ),
    );
    expect(new Set(results.map((result) => result.result.id)).size).toBe(1);
    expect(await counts(harness, projectId)).toEqual({
      issues: 1,
      form_submissions: 1,
      timeline_events: 1,
      outbox: 1,
      mutation_receipts: 1,
    });
    await expect(
      harness.repository.createIssue({ ...intent(), body: 'Spoofed' }),
    ).rejects.toMatchObject({ code: 'FORM_ANSWERS_INVALID' });
    const upload = {
      ...request.formSubmission!,
      values: { details: 'Canonical **answers**', files: [nextId()] },
    };
    await expect(
      harness.repository.createIssue({
        ...intent(),
        formSubmission: upload,
        body: validateIssueFormAnswers(definition, upload.values).markdown,
      }),
    ).rejects.toMatchObject({ code: 'FORM_ATTACHMENTS_INVALID' });
    await store.saveForm({
      id: formId,
      projectId,
      expectedRevision: 1,
      enabled: false,
      now: now + 1,
      definition,
    });
    expect((await harness.repository.createIssue(request)).result.id).toBe(
      results[0]!.result.id,
    );
    await expect(
      harness.repository.createIssue(intent()),
    ).rejects.toMatchObject({ code: 'FORM_VERSION_STALE' });
    expect(await counts(harness, projectId)).toEqual({
      issues: 1,
      form_submissions: 1,
      timeline_events: 1,
      outbox: 1,
      mutation_receipts: 1,
    });
    expect(
      Number(
        (
          await harness.query(
            'SELECT next_issue_number FROM projects WHERE id = ?',
            [projectId],
          )
        )[0]!.next_issue_number,
      ),
    ).toBe(2);
  });
  it('serializes form edits and submissions without orphan records or consumed numbers', async () => {
    const { harness, store, projectId, formId, definition, intent } =
      await fixture();
    const attempts = await Promise.allSettled([
      ...Array.from({ length: 8 }, () =>
        harness.repository.createIssue(intent()),
      ),
      store.saveForm({
        id: formId,
        projectId,
        expectedRevision: 1,
        enabled: true,
        now: now + 1,
        definition: { ...definition, name: 'Edited' },
      }),
    ]);
    expect(attempts.at(-1)!.status).toBe('fulfilled');
    const submissions = attempts.slice(0, -1);
    const successes = submissions.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    expect(
      submissions
        .filter((result) => result.status === 'rejected')
        .every((result) => result.reason.code === 'FORM_VERSION_STALE'),
    ).toBe(true);
    expect(await counts(harness, projectId)).toEqual({
      issues: successes,
      form_submissions: successes,
      timeline_events: successes,
      outbox: successes,
      mutation_receipts: successes,
    });
    expect(
      Number(
        (
          await harness.query(
            'SELECT next_issue_number FROM projects WHERE id = ?',
            [projectId],
          )
        )[0]!.next_issue_number,
      ),
    ).toBe(successes + 1);
    expect(
      (
        await harness.query(
          'SELECT form_version FROM form_submissions WHERE project_id = ?',
          [projectId],
        )
      ).every((row) => row.form_version === 1),
    ).toBe(true);
  });
  it('rejects a currently suspended reporter and foreign project form without partial effects', async () => {
    const { harness, projectId, principalId, intent } = await fixture();
    await harness.query(
      "UPDATE principals SET status = 'suspended' WHERE id = ?",
      [principalId],
    );
    await expect(
      harness.repository.createIssue(intent()),
    ).rejects.toMatchObject({ code: 'FORM_SUBMISSION_FORBIDDEN' });
    await harness.query(
      "UPDATE principals SET status = 'active' WHERE id = ?",
      [principalId],
    );
    const foreign = { ...intent(), projectId: nextId() };
    await expect(harness.repository.createIssue(foreign)).rejects.toThrow();
    expect(await counts(harness, projectId)).toEqual({
      issues: 0,
      form_submissions: 0,
      timeline_events: 0,
      outbox: 0,
      mutation_receipts: 0,
    });
  });
}

/** Trusted synthetic lifecycle fixture; this never proves malware detection. */
export async function seedFormUpload(
  store: UploadIntentStore,
  scope: { projectId: string; principalId: string },
  options: {
    mode?: string;
    draftId?: string;
    now?: number;
    filename?: string;
  } = {},
) {
  const at = options.now ?? now;
  const input = {
    id: nextId(),
    projectId: scope.projectId,
    principalId: scope.principalId,
    stagingKey: blobKey(),
    finalKey: blobKey('objects'),
    filename: options.filename ?? 'fixture.txt',
    contentType: 'text/plain',
    maxBytes: 4,
    now: at,
    expiresAt: at + 60000,
    association: {
      kind: 'issue-draft' as const,
      draftId: options.draftId ?? nextId(),
    },
  } satisfies ReserveUpload;
  await store.reserve(input);
  if (options.mode === 'pending') return input;
  await store.requestFinalize(input, at);
  const token = { ...input, leaseId: nextId(), leaseExpiresAt: at + 1000 };
  await store.claim(token);
  await store.commitVerified({
    ...token,
    verified: {
      key: input.finalKey,
      size: 3,
      sha256: 'a'.repeat(64),
      contentType: input.contentType,
      providerVersion: null,
      scanStatus: 'unscanned',
    },
  });
  if (options.mode === 'unscanned') return input;
  const policyVersion =
    options.mode === 'stale-policy'
      ? 'old-scan-policy'
      : attachmentScanPolicyVersion;
  const scan = { ...token, leaseId: nextId() };
  await store.mutateScan({ ...scan, kind: 'claim', policyVersion });
  const outcome: ScanOutcome =
    options.mode === 'infected'
      ? { ...syntheticClean, status: 'infected' }
      : options.mode === 'failed'
        ? { status: 'failed', failure: 'partial' }
        : syntheticClean;
  await store.mutateScan({ ...scan, kind: 'commit', outcome });
  if (!['quarantined', 'infected', 'failed'].includes(options.mode ?? ''))
    await store.mutateScan({
      ...scan,
      kind: 'release',
      policyVersion,
      attemptId: scan.leaseId,
    });
  return input;
}

export async function seedFormSubmissionFixture(
  harness: RepositoryHarness,
  store: ContentDefinitionStore,
) {
  const projectId = nextId();
  const principalId = nextId();
  const formId = nextId();
  await harness.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [projectId, `submission-${projectId}`, 'Submission', now, now],
  );
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, status, created_at) VALUES (?, 'user', 'Reporter', 'active', ?)",
    [principalId, now],
  );
  const definition = normalizeIssueFormDefinition({
    name: 'Report',
    description: 'Report',
    body: [
      {
        type: 'textarea',
        id: 'details',
        attributes: { label: 'Details' },
        validations: { required: true },
      },
      { type: 'upload', id: 'files', attributes: { label: 'Files' } },
    ],
  });
  await store.saveForm({
    id: formId,
    projectId,
    expectedRevision: null,
    enabled: true,
    now,
    definition,
  });
  const values = { details: 'Canonical **answers**', files: [] };
  const validated = validateIssueFormAnswers(definition, values);
  const intent = (): CreateIssueIntent => ({
    id: nextId(),
    mutationId: nextId(),
    requestId: nextId(),
    projectId,
    principalId,
    keyHash: nextId().replaceAll('-', '').padEnd(64, '0'),
    payloadHash: 'b'.repeat(64),
    now,
    expiresAt: now + 86400000,
    title: 'Report',
    body: validated.markdown,
    typeId: null,
    milestoneId: null,
    labelIds: [],
    assigneeIds: [],
    formSubmission: { formId, formVersion: 1, values },
  });
  return { harness, store, projectId, principalId, formId, definition, intent };
}
