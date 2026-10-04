import { expect } from 'vitest';
import {
  completeIssueFormYaml,
  validFormAnswers,
  attachmentA,
} from './issue-form-corpus.ts';
import {
  normalizeIssueFormDefinition,
  validateIssueFormAnswers,
  type IssueFormDefinition,
} from '@hyperbug/application';
import { contentPolicyVersion } from '../../packages/security/src/markdown/index.ts';

export async function contentDefinitionHttpContract(options: {
  token: string;
  userToken: string;
  principalId: string;
  call(
    path: string,
    init?: {
      method?: string;
      token?: string;
      body?: unknown;
      origin?: string | null;
      idempotencyKey?: string;
    },
  ): Promise<{
    status: number;
    headers: { get(name: string): string | null };
    json(): Promise<unknown>;
  }>;
  query(
    sql: string,
    values: (string | number)[],
  ): Promise<Record<string, unknown>[]>;
  seedAttachment(scope: {
    projectId: string;
    principalId: string;
    draftId: string;
  }): Promise<string>;
}) {
  const { token, userToken, principalId, call, query } = options;
  const created = await call('/api/v1/projects', {
    method: 'POST',
    token,
    body: {
      slug: `content-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Content definitions',
    },
  });
  expect(created.status).toBe(201);
  const projectId = ((await created.json()) as { id: string }).id;
  const base = `/api/v1/projects/${projectId}`;
  const formInput = {
    format: 'yaml',
    source: completeIssueFormYaml,
    enabled: true,
  };
  expect(
    (await call(`${base}/forms`, { method: 'POST', body: formInput })).status,
  ).toBe(401);
  expect(
    (
      await call(`${base}/forms`, {
        method: 'POST',
        token: userToken,
        body: formInput,
      })
    ).status,
  ).toBe(403);
  await query(
    "UPDATE project_roles SET role = 'triage' WHERE project_id = ? AND principal_id = ?",
    [projectId, principalId],
  );
  expect(
    (await call(`${base}/forms`, { method: 'POST', token, body: formInput }))
      .status,
  ).toBe(403);
  await query(
    "UPDATE project_roles SET role = 'maintainer' WHERE project_id = ? AND principal_id = ?",
    [projectId, principalId],
  );
  const formResponse = await call(`${base}/forms`, {
    method: 'POST',
    token,
    body: formInput,
  });
  expect(formResponse.status).toBe(201);
  expect(formResponse.headers.get('cache-control')).toBe('no-store');
  const form = (await formResponse.json()) as {
    id: string;
    definition: unknown;
    renderedFields: unknown[];
    contentPolicyVersion: string;
  };
  expect(form.renderedFields).toHaveLength(7);
  expect(form.contentPolicyVersion).toBe(contentPolicyVersion);
  expect(JSON.stringify(form.renderedFields)).not.toContain('untrusted notice');
  const anonymous = await call(`${base}/forms/${form.id}`, { origin: null });
  expect(anonymous.status).toBe(200);
  expect(await anonymous.json()).toEqual(form);
  const list = await call(`${base}/forms`, { origin: null });
  expect(list.status).toBe(200);
  expect(JSON.stringify(await list.json())).not.toMatch(/definition|body|Tree/);
  const invalid = await call(`${base}/forms`, {
    method: 'POST',
    token,
    body: { ...formInput, source: 'name: x\nname: duplicate' },
  });
  expect(invalid.status).toBe(400);
  expect(JSON.stringify(await invalid.json())).not.toContain('duplicate');
  const replace = {
    format: 'canonical',
    definition: form.definition,
    enabled: false,
    expectedRevision: 1,
  };
  const disabled = await call(`${base}/forms/${form.id}`, {
    method: 'PUT',
    token,
    body: replace,
  });
  expect(disabled.status).toBe(200);
  expect(await disabled.json()).toMatchObject({
    version: 2,
    revision: 2,
    enabled: false,
  });
  expect(
    (
      await call(`${base}/forms/${form.id}`, {
        method: 'PUT',
        token,
        body: replace,
      })
    ).status,
  ).toBe(409);
  expect(
    (await call(`${base}/forms/${form.id}`, { origin: null })).status,
  ).toBe(404);
  expect(
    (await call(`${base}/forms/${form.id}?version=1`, { token: userToken }))
      .status,
  ).toBe(403);
  expect(
    (await call(`${base}/forms?includeDisabled=true`, { token: userToken }))
      .status,
  ).toBe(403);
  expect(await (await call(`${base}/forms`, { origin: null })).json()).toEqual({
    items: [],
  });
  const history = await call(`${base}/forms/${form.id}?version=1`, { token });
  expect(history.status).toBe(200);
  expect(await history.json()).toMatchObject({
    version: 1,
    revision: 2,
    definition: form.definition,
  });
  const labels: string[] = [];
  for (const name of ['bug', 'triage']) {
    const response = await call(`${base}/labels`, {
      method: 'POST',
      token,
      body: { name },
    });
    expect(response.status).toBe(201);
    labels.push(((await response.json()) as { id: string }).id);
  }
  const type = await call(`${base}/issue-types`, {
    method: 'POST',
    token,
    body: { name: 'Bug' },
  });
  expect(type.status).toBe(201);
  const typeId = ((await type.json()) as { id: string }).id;
  const handle = (
    await query(
      "SELECT subject FROM identities WHERE principal_id = ? AND provider = 'local-password'",
      [principalId],
    )
  )[0]!.subject;
  const schema = form.definition as IssueFormDefinition;
  const submissionDefinition = normalizeIssueFormDefinition(
    {
      ...schema,
      name: 'Submittable',
      assignees: [handle],
      body: schema.body.map((field) =>
        field.type === 'upload'
          ? { ...field, validations: { ...field.validations, required: false } }
          : field,
      ),
    },
    'canonical',
  );
  const formForSubmit = await call(`${base}/forms`, {
    method: 'POST',
    token,
    body: {
      format: 'canonical',
      definition: submissionDefinition,
      enabled: true,
    },
  });
  expect(formForSubmit.status).toBe(201);
  const submissionFormId = ((await formForSubmit.json()) as { id: string }).id;
  const submissionPath = `${base}/forms/${submissionFormId}/submissions`;
  const values = { ...validFormAnswers, files: [] };
  const input = { title: 'Form report', formVersion: 1, values };
  const expected = validateIssueFormAnswers(submissionDefinition, values);
  const submit = await call(submissionPath, {
    method: 'POST',
    token: userToken,
    body: input,
    idempotencyKey: 'form-receipt-00001',
  });
  expect(submit.status).toBe(201);
  const issue = (await submit.json()) as { id: string; body: string };
  expect(issue).toMatchObject({
    body: expected.markdown,
    labelIds: [...labels].sort(),
    assigneeIds: [principalId],
    typeId,
  });
  const stored = (
    await query(
      'SELECT form_id, form_version, "values" FROM form_submissions WHERE issue_id = ?',
      [issue.id],
    )
  )[0]!;
  expect(stored.form_id).toBe(submissionFormId);
  expect(stored.form_version).toBe(1);
  expect(
    typeof stored.values === 'string'
      ? JSON.parse(stored.values)
      : stored.values,
  ).toEqual(expected.values);
  const draftId = crypto.randomUUID();
  const authorId = String(
    (await query('SELECT author_id FROM issues WHERE id = ?', [issue.id]))[0]!
      .author_id,
  );
  const attachmentId = await options.seedAttachment({
    projectId,
    principalId: authorId,
    draftId,
  });
  const attachmentInput = {
    ...input,
    draftId,
    values: { ...values, files: [attachmentId] },
  };
  const linked = await call(submissionPath, {
    method: 'POST',
    token: userToken,
    body: attachmentInput,
    idempotencyKey: 'form-attachment-0001',
  });
  expect(linked.status).toBe(201);
  const linkedIssue = (await linked.json()) as { id: string; body: string };
  expect(linkedIssue.body).toBe(
    validateIssueFormAnswers(submissionDefinition, attachmentInput.values)
      .markdown,
  );
  expect(linkedIssue.body).toContain(`/attachments/${attachmentId}`);
  expect(
    await query('SELECT id FROM attachments WHERE issue_id = ?', [
      linkedIssue.id,
    ]),
  ).toEqual([{ id: attachmentId }]);
  const attachmentReplay = await call(submissionPath, {
    method: 'POST',
    token: userToken,
    body: attachmentInput,
    idempotencyKey: 'form-attachment-0001',
  });
  expect(attachmentReplay.status).toBe(201);
  expect(await attachmentReplay.json()).toMatchObject({ id: linkedIssue.id });
  const reused = await call(submissionPath, {
    method: 'POST',
    token: userToken,
    body: attachmentInput,
  });
  expect(reused.status).toBe(400);
  expect(await reused.json()).toMatchObject({
    error: { code: 'FORM_ATTACHMENTS_INVALID' },
  });
  expect(
    (
      await call(submissionPath, {
        method: 'POST',
        token: userToken,
        body: { ...input, values: { ...values, files: [attachmentA] } },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await call(submissionPath, {
        method: 'POST',
        token: userToken,
        body: { ...input, values: { ...values, version: '' } },
      })
    ).status,
  ).toBe(400);
  await call(`${base}/forms/${submissionFormId}`, {
    method: 'PUT',
    token,
    body: {
      format: 'canonical',
      definition: submissionDefinition,
      enabled: false,
      expectedRevision: 1,
    },
  });
  await query("UPDATE labels SET name_key = 'renamed' WHERE id = ?", [
    labels[0]!,
  ]);
  const replay = await call(submissionPath, {
    method: 'POST',
    token: userToken,
    body: input,
    idempotencyKey: 'form-receipt-00001',
  });
  expect(replay.status).toBe(201);
  expect(await replay.json()).toMatchObject({
    id: issue.id,
    body: expected.markdown,
  });
  expect(
    (
      await call(submissionPath, {
        method: 'POST',
        token: userToken,
        body: input,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await call(submissionPath, {
        method: 'POST',
        token: userToken,
        body: { ...input, title: 'Different' },
        idempotencyKey: 'form-receipt-00001',
      })
    ).status,
  ).toBe(409);
  const edit = await call(`${base}/issues/${issue.id}`, {
    method: 'PATCH',
    token: userToken,
    body: { expectedRevision: 1, title: 'Edited', body: 'New body' },
  });
  expect(edit.status).toBe(200);
  expect(
    (
      await query('SELECT "values" FROM form_submissions WHERE issue_id = ?', [
        issue.id,
      ])
    )[0]!.values,
  ).toEqual(stored.values);
  const templateInput = {
    name: 'Plain template',
    body: '**safe** <script>private-script</script> ![image](https://tracker.example/pixel)',
    enabled: true,
  };
  const templateResponse = await call(`${base}/templates`, {
    method: 'POST',
    token,
    body: templateInput,
  });
  expect(templateResponse.status).toBe(201);
  const template = (await templateResponse.json()) as {
    id: string;
    bodyTree: unknown;
  };
  expect(JSON.stringify(template.bodyTree)).not.toContain('private-script');
  expect(JSON.stringify(template.bodyTree)).toContain('external');
  expect(
    (
      await call(`${base}/templates/${template.id}`, {
        method: 'PUT',
        token: userToken,
        body: { ...templateInput, expectedRevision: 1 },
      })
    ).status,
  ).toBe(403);
  const other = await call('/api/v1/projects', {
    method: 'POST',
    token,
    body: {
      slug: `content-other-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Other project',
    },
  });
  const otherId = ((await other.json()) as { id: string }).id;
  expect(
    (
      await call(`/api/v1/projects/${otherId}/templates/${template.id}`, {
        token,
      })
    ).status,
  ).toBe(404);
  await query("UPDATE projects SET status = 'archived' WHERE id = ?", [
    projectId,
  ]);
  expect(
    (await call(`${base}/forms/${form.id}?version=1`, { token })).status,
  ).toBe(200);
  expect((await call(`${base}/templates`, { origin: null })).status).toBe(200);
  expect(
    (
      await call(`${base}/templates/${template.id}`, {
        method: 'PUT',
        token,
        body: { ...templateInput, expectedRevision: 1 },
      })
    ).status,
  ).toBe(403);
  await query(
    "UPDATE project_roles SET role = 'triage' WHERE project_id = ? AND principal_id = ?",
    [projectId, principalId],
  );
  expect(
    (await call(`${base}/forms/${form.id}?version=1`, { token })).status,
  ).toBe(403);
}
