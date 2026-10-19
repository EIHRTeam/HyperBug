import { expect } from 'vitest';

type JourneyCall = (
  path: string,
  init?: {
    method?: string;
    token?: string;
    body?: unknown;
    idempotencyKey?: string;
  },
) => Promise<{ status: number; json(): Promise<unknown> }>;

/** HTTP form/upload seam. Storage processing is manual; scanner verdict is explicitly synthetic. */
export async function createAcceptanceFormIssue(options: {
  call: JourneyCall;
  projectId: string;
  staffToken: string;
  authorToken: string;
  proof(id: string, operation: string, text?: string): Promise<unknown>;
}) {
  const { call, projectId, staffToken, authorToken, proof } = options;
  const base = `/api/v1/projects/${projectId}`;
  const form = await call(`${base}/forms`, {
    method: 'POST',
    token: staffToken,
    body: {
      format: 'yaml',
      enabled: true,
      source:
        'name: Journey\ndescription: Backend acceptance\nbody:\n- type: textarea\n  id: details\n  attributes:\n    label: Details\n  validations:\n    required: true\n- type: upload\n  id: file\n  attributes:\n    label: File\n  validations:\n    required: true\n',
    },
  });
  expect(form.status).toBe(201);
  const { id: formId } = (await form.json()) as { id: string };
  const id = crypto.randomUUID(),
    draftId = crypto.randomUUID();
  const upload = `${base}/uploads/${id}`;
  const reserved = await call(upload, {
    method: 'PUT',
    token: authorToken,
    body: {
      filename: 'journey.txt',
      contentType: 'text/plain',
      maxBytes: 7,
      association: { kind: 'issue-draft', draftId },
    },
  });
  expect(reserved.status).toBe(200);
  expect(await reserved.json()).toMatchObject({
    scanStatus: 'unscanned',
    policyState: 'quarantined',
  });
  const capability = await call(`${upload}/capability`, {
    method: 'POST',
    token: authorToken,
    body: {},
  });
  expect(capability.status).toBe(200);
  expect(await capability.json()).toMatchObject({
    method: 'PUT',
    headers: { 'content-type': 'text/plain' },
  });
  await proof(id, 'stage', 'proof10');
  expect(
    (
      await call(`${upload}/finalize`, {
        method: 'POST',
        token: authorToken,
        body: {},
      })
    ).status,
  ).toBe(202);
  await proof(id, 'process');
  await proof(id, 'synthetic-scan');
  const input = {
    formVersion: 1,
    title: 'Crash during the journey',
    draftId,
    values: { details: 'Full workflow body 🚀', file: [id] },
  };
  const response = await call(`${base}/forms/${formId}/submissions`, {
    method: 'POST',
    token: authorToken,
    body: input,
    idempotencyKey: 'acceptance-form-journey-1',
  });
  expect(response.status).toBe(201);
  const issue = await response.json();
  const replay = await call(`${base}/forms/${formId}/submissions`, {
    method: 'POST',
    token: authorToken,
    body: input,
    idempotencyKey: 'acceptance-form-journey-1',
  });
  expect(replay.status).toBe(201);
  expect(await replay.json()).toEqual(issue);
  return issue;
}

export async function searchAcceptanceIssue(
  call: JourneyCall,
  projectId: string,
  issueId: string,
  backfill: () => Promise<unknown>,
) {
  const path = `/api/v1/projects/${projectId}/search?q=Crash`;
  expect((await call(path)).status).toBe(503);
  await backfill();
  const result = await call(path);
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({
    items: [{ id: issueId }],
    nextCursor: null,
  });
}
