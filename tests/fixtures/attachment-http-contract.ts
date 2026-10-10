import { expect } from 'vitest';
import { attachmentScanPolicyVersion } from '@hyperbug/application';
/* eslint-disable no-await-in-loop -- Bounded state/authorization transitions must be verified in order. */
export async function attachmentHttpContract(options: {
  token: string;
  userToken: string;
  call(
    path: string,
    init?: {
      method?: string;
      token?: string;
      body?: unknown;
      origin?: string | null;
      idempotencyKey?: string;
    },
  ): Promise<{ status: number; json(): Promise<unknown> }>;
  media(
    path: string,
    init?: { method?: string; headers?: Record<string, string> },
  ): Promise<{
    status: number;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
  }>;
  query(
    sql: string,
    args: (string | number)[],
  ): Promise<Record<string, unknown>[]>;
  proof(id: string, operation: string, text?: string): Promise<unknown>;
  allowedOrigin: string;
  mediaMismatch(
    path: string,
  ): Promise<{ status: number; headers: { get(name: string): string | null } }>;
  observations(): Promise<string>;
}) {
  const { call, media, query, token, userToken } = options;
  const created = await call('/api/v1/projects', {
    method: 'POST',
    token,
    body: { slug: `media-${crypto.randomUUID().slice(0, 8)}`, name: 'Media' },
  });
  expect(created.status).toBe(201);
  const projectId = ((await created.json()) as { id: string }).id;
  const formResponse = await call(`/api/v1/projects/${projectId}/forms`, {
    method: 'POST',
    token,
    body: {
      format: 'yaml',
      enabled: true,
      source:
        'name: Media\ndescription: Media\nbody:\n- type: upload\n  id: file\n  attributes:\n    label: File\n  validations:\n    required: true\n',
    },
  });
  expect(formResponse.status).toBe(201);
  const formId = ((await formResponse.json()) as { id: string }).id;
  const id = crypto.randomUUID(),
    draftId = crypto.randomUUID();
  const text = '<html><script>active</script></html>';
  const uploadPath = `/api/v1/projects/${projectId}/uploads/${id}`;
  expect(
    (
      await call(uploadPath, {
        method: 'PUT',
        token: userToken,
        body: {
          filename: '用户报告.html',
          contentType: 'text/html',
          maxBytes: new TextEncoder().encode(text).length,
          association: { kind: 'issue-draft', draftId },
        },
      })
    ).status,
  ).toBe(200);
  await options.proof(id, 'stage', text);
  expect(
    (
      await call(`${uploadPath}/finalize`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(202);
  await options.proof(id, 'process');
  // Explicitly synthetic scanner: media authorization proof, not malware detection.
  await options.proof(id, 'synthetic-scan');
  const submission = await call(
    `/api/v1/projects/${projectId}/forms/${formId}/submissions`,
    {
      method: 'POST',
      token: userToken,
      body: {
        formVersion: 1,
        title: 'Media file',
        draftId,
        values: { file: [id] },
      },
    },
  );
  expect(submission.status).toBe(201);
  const issueId = ((await submission.json()) as { id: string }).id;
  const path = `/attachments/${id}`;
  expect((await call(path, { origin: null })).status).toBe(404);
  const anonymous = await media(path);
  expect(
    anonymous.status,
    anonymous.status === 200 ? undefined : await anonymous.text(),
  ).toBe(200);
  expect(anonymous.headers.get('cache-control')).toBe('no-store');
  expect(anonymous.headers.get('x-content-type-options')).toBe('nosniff');
  expect(anonymous.headers.get('content-type')).toBe(
    'application/octet-stream',
  );
  expect(anonymous.headers.get('content-disposition')).toContain(
    'attachment; filename="____.html"',
  );
  expect(anonymous.headers.get('content-disposition')).toContain(
    "filename*=UTF-8''",
  );
  expect(anonymous.headers.get('content-security-policy')).toContain('sandbox');
  expect(anonymous.headers.get('set-cookie')).toBeNull();
  expect(anonymous.headers.get('location')).toBeNull();
  expect(await anonymous.text()).toBe(text);
  const head = await media(path, { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(head.headers.get('content-length')).toBe(String(text.length));
  expect(await head.text()).toBe('');
  const partial = await media(path, {
    headers: { range: 'bytes=0-5', origin: options.allowedOrigin },
  });
  expect(partial.status).toBe(206);
  expect(partial.headers.get('content-range')).toBe(`bytes 0-5/${text.length}`);
  expect(partial.headers.get('access-control-allow-origin')).toBe(
    options.allowedOrigin,
  );
  expect(partial.headers.get('access-control-allow-credentials')).toBeNull();
  expect(await partial.text()).toBe(text.slice(0, 6));
  expect(
    (await media(path, { headers: { range: 'bytes=0-1,3-4' } })).status,
  ).toBe(416);
  const preflight = await media(path, {
    method: 'OPTIONS',
    headers: {
      origin: options.allowedOrigin,
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization, range',
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get('access-control-allow-methods')).toBe(
    'GET, HEAD',
  );
  expect(preflight.headers.get('vary')).toContain(
    'Access-Control-Request-Headers',
  );
  expect(
    (await media(path, { headers: { origin: 'https://evil.example' } })).status,
  ).toBe(403);
  expect((await media('/auth/session')).status).toBe(404);
  const login = await media('/auth/login', { method: 'POST' });
  expect(login.status).toBe(404);
  expect(login.headers.get('set-cookie')).toBeNull();
  expect((await media('/api/v1/projects')).status).toBe(404);
  for (const address of [
    '/auth/session',
    '/auth/login',
    '/api/v1/projects',
    path,
  ]) {
    const fenced = await options.mediaMismatch(address);
    expect(fenced.status).toBe(404);
    expect(fenced.headers.get('set-cookie')).toBeNull();
  }
  for (const policy of ['pending', 'quarantined', 'deleted']) {
    await query('UPDATE attachments SET policy_state = ? WHERE id = ?', [
      policy,
      id,
    ]);
    expect((await media(path)).status).toBe(404);
  }
  await query("UPDATE attachments SET policy_state = 'ready' WHERE id = ?", [
    id,
  ]);
  await query(
    "UPDATE upload_intent_details SET policy_state = 'quarantined' WHERE intent_id = ?",
    [id],
  );
  expect((await media(path)).status).toBe(404);
  await query(
    "UPDATE upload_scan_results SET policy_version = 'obsolete' WHERE intent_id = ?",
    [id],
  );
  expect((await media(path)).status).toBe(404);
  await query(
    'UPDATE upload_scan_results SET policy_version = ? WHERE intent_id = ?',
    [attachmentScanPolicyVersion, id],
  );
  await query(
    "UPDATE upload_intent_details SET policy_state = 'ready' WHERE intent_id = ?",
    [id],
  );
  const restored = await media(path);
  expect(restored.status).toBe(200);
  expect(await restored.text()).toBe(text);
  await query("UPDATE projects SET visibility = 'private' WHERE id = ?", [
    projectId,
  ]);
  expect((await media(path)).status).toBe(404);
  expect(
    (
      await media(path, {
        headers: { cookie: '__Host-hyperbug-auth=untrusted' },
      })
    ).status,
  ).toBe(404);
  expect(
    (await media(path, { headers: { authorization: `Bearer ${userToken}` } }))
      .status,
  ).toBe(404);
  const member = await media(path, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(member.status).toBe(200);
  expect(await member.text()).toBe(text);
  const memberId = (
    await query('SELECT principal_id FROM project_roles WHERE project_id = ?', [
      projectId,
    ])
  )[0]!.principal_id as string;
  await query("UPDATE principals SET status = 'suspended' WHERE id = ?", [
    memberId,
  ]);
  expect(
    (await media(path, { headers: { authorization: `Bearer ${token}` } }))
      .status,
  ).toBe(403);
  await query("UPDATE principals SET status = 'active' WHERE id = ?", [
    memberId,
  ]);
  const tokenId = token.slice(3).split('.')[0]!;
  await query('UPDATE oauth_access_tokens SET revoked_at = ? WHERE id = ?', [
    Date.now(),
    tokenId,
  ]);
  expect(
    (await media(path, { headers: { authorization: `Bearer ${token}` } }))
      .status,
  ).toBe(404);
  await query('UPDATE oauth_access_tokens SET revoked_at = NULL WHERE id = ?', [
    tokenId,
  ]);
  await query("UPDATE projects SET status = 'archived' WHERE id = ?", [
    projectId,
  ]);
  expect(
    (
      await media(path, {
        method: 'HEAD',
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
  ).toBe(200);
  await query('DELETE FROM project_roles WHERE project_id = ?', [projectId]);
  expect(
    (await media(path, { headers: { authorization: `Bearer ${token}` } }))
      .status,
  ).toBe(404);
  await query("UPDATE projects SET visibility = 'public' WHERE id = ?", [
    projectId,
  ]);
  await query("UPDATE projects SET status = 'active' WHERE id = ?", [
    projectId,
  ]);
  const commentCreated = await call(
    `/api/v1/projects/${projectId}/issues/${issueId}/comments`,
    {
      method: 'POST',
      token: userToken,
      body: { body: 'Attachment parent fixture' },
    },
  );
  expect(commentCreated.status).toBe(201);
  const commentId = ((await commentCreated.json()) as { id: string }).id;
  // Internal storage fixture only: general comment attachment linking is still separate work.
  await query(
    'UPDATE attachments SET issue_id = NULL, comment_id = ? WHERE id = ?',
    [commentId, id],
  );
  await query(
    "UPDATE upload_intent_details SET association_kind = 'comment', issue_id = NULL, comment_id = ? WHERE intent_id = ?",
    [commentId, id],
  );
  const commentFile = await media(path);
  expect(commentFile.status).toBe(200);
  expect(await commentFile.text()).toBe(text);
  for (const moderation of ['hidden', 'redacted']) {
    await query('UPDATE comments SET moderation = ? WHERE id = ?', [
      moderation,
      commentId,
    ]);
    expect((await media(path)).status).toBe(404);
  }
  await query(
    "UPDATE comments SET moderation = 'visible', deleted_at = ? WHERE id = ?",
    [Date.now(), commentId],
  );
  expect((await media(path)).status).toBe(404);
  await query('UPDATE comments SET deleted_at = NULL WHERE id = ?', [
    commentId,
  ]);
  await query("UPDATE issues SET moderation = 'hidden' WHERE id = ?", [
    issueId,
  ]);
  expect((await media(path)).status).toBe(404);
  await query(
    "UPDATE issues SET moderation = 'visible', deleted_at = ? WHERE id = ?",
    [Date.now(), issueId],
  );
  expect((await media(path)).status).toBe(404);
  const persisted = (
    await query('SELECT object_key, checksum FROM attachments WHERE id = ?', [
      id,
    ])
  )[0]!;
  const observations = await options.observations();
  expect(observations).toContain('attachment.media');
  expect(observations).toContain(anonymous.headers.get('x-request-id'));
  for (const privateValue of [
    token,
    userToken,
    persisted.object_key,
    persisted.checksum,
    'synthetic-test-scanner',
    'X-Amz-Signature',
  ])
    expect(observations).not.toContain(String(privateValue));
}
