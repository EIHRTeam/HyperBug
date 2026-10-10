import { expect } from 'vitest';
import type {
  UploadDocument,
  UploadCapabilityDocument,
  MultipartDocument,
} from '@hyperbug/contracts';

export async function uploadHttpContract(options: {
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
  ): Promise<{
    status: number;
    headers: { get(name: string): string | null };
    json(): Promise<unknown>;
  }>;
  query(
    sql: string,
    values: (string | number)[],
  ): Promise<Record<string, unknown>[]>;
  failSigning(id: string): Promise<void>;
  observations(): Promise<string>;
  stage(id: string, text: string): Promise<void>;
  process(id: string): Promise<void>;
  finalText(id: string): Promise<string>;
  finalSize(id: string): Promise<number>;
  stagePart(
    id: string,
    number: number,
    size: number,
  ): Promise<{ etag: string; sizeBytes: number }>;
  failCompletion(id: string): Promise<void>;
  syntheticScan(id: string, partial: boolean): Promise<void>;
  cleanup(id: string, failDelete: boolean): Promise<void>;
}) {
  const { call, query, token, userToken } = options;
  const projectResponse = await call('/api/v1/projects', {
    method: 'POST',
    token,
    body: {
      slug: `uploads-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Uploads',
    },
  });
  expect(projectResponse.status).toBe(201);
  const projectId = ((await projectResponse.json()) as { id: string }).id;
  const id = crypto.randomUUID(),
    base = `/api/v1/projects/${projectId}/uploads`,
    path = `${base}/${id}`;
  const input = {
    filename: 'fixture.txt',
    contentType: 'text/plain',
    maxBytes: 4,
    association: { kind: 'issue-draft', draftId: crypto.randomUUID() },
  };
  expect((await call(path, { method: 'PUT', body: input })).status).toBe(401);
  expect(
    (
      await call(path, {
        method: 'PUT',
        token: userToken,
        body: { ...input, maxBytes: 0 },
      })
    ).status,
  ).toBe(400);
  const reservations = await Promise.all(
    Array.from({ length: 8 }, () =>
      call(path, { method: 'PUT', token: userToken, body: input }),
    ),
  );
  expect(reservations.map((r) => r.status)).toEqual(Array(8).fill(200));
  const record = (await reservations[0]!.json()) as UploadDocument;
  expect(record).toMatchObject({
    state: 'pending',
    actualBytes: null,
    scanStatus: 'unscanned',
    policyState: 'quarantined',
  });
  expect(reservations[0]!.headers.get('cache-control')).toBe('no-store');
  for (const privateField of [
    'principalId',
    'stagingKey',
    'finalKey',
    'leaseId',
    'verified',
    'sha256',
    'url',
  ])
    expect(record).not.toHaveProperty(privateField);
  expect((await call(path, { token })).status).toBe(404);
  expect(
    (
      await call(path, {
        method: 'PUT',
        token: userToken,
        body: { ...input, filename: 'different.txt' },
      })
    ).status,
  ).toBe(409);
  const capabilityResponse = await call(`${path}/capability`, {
    method: 'POST',
    token: userToken,
    body: {},
  });
  expect(capabilityResponse.status).toBe(200);
  expect(capabilityResponse.headers.get('cache-control')).toBe('no-store');
  const capability =
    (await capabilityResponse.json()) as UploadCapabilityDocument;
  expect(capability.method).toBe('PUT');
  expect(capability.headers['content-type']).toBe('text/plain');
  expect(new URL(capability.url).searchParams.get('X-Amz-Expires')).toBe('300');
  expect(
    new Date(capability.expiresAt).getTime() - Date.now(),
  ).toBeLessThanOrEqual(300000);
  expect(
    (await call(`${path}/capability`, { method: 'POST', token, body: {} }))
      .status,
  ).toBe(404);
  await options.failSigning(id);
  const unavailable = await call(`${path}/capability`, {
    method: 'POST',
    token: userToken,
    body: {},
  });
  expect(unavailable.status).toBe(503);
  const failure = JSON.stringify(await unavailable.json());
  expect(failure).toContain('UPLOAD_UNAVAILABLE');
  expect(failure).not.toContain('private-signer-token-fixture');
  await options.stage(id, 'abc');
  const finalize = await Promise.all(
    Array.from({ length: 8 }, () =>
      call(`${path}/finalize`, { method: 'POST', token: userToken, body: {} }),
    ),
  );
  expect(finalize.map((r) => r.status)).toEqual(Array(8).fill(202));
  expect(await finalize[0]!.json()).toMatchObject({
    state: 'awaiting-processing',
    scanStatus: 'unscanned',
  });
  expect(
    (
      await call(`${path}/capability`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(409);
  // Manual background invocation only. No Module 09 dispatcher or scan/release claim.
  await options.process(id);
  const verified = await call(path, { token: userToken });
  expect(verified.status).toBe(200);
  expect(await verified.json()).toMatchObject({
    state: 'quarantined',
    scanStatus: 'unscanned',
    policyState: 'quarantined',
    actualBytes: 3,
  });
  expect(
    (
      await call(`${path}/finalize`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(200);
  await options.stage(id, 'evil');
  await options.process(id);
  expect(await options.finalText(id)).toBe('abc');
  expect(
    (
      await query(
        'SELECT reserved_bytes, used_bytes, reserved_count FROM project_upload_usage WHERE project_id = ?',
        [projectId],
      )
    )[0],
  ).toMatchObject({
    reserved_bytes: expect.anything(),
    used_bytes: expect.anything(),
  });
  const usage = (
    await query(
      'SELECT reserved_bytes, used_bytes, reserved_count FROM project_upload_usage WHERE project_id = ?',
      [projectId],
    )
  )[0]!;
  expect([
    Number(usage.reserved_bytes),
    Number(usage.used_bytes),
    Number(usage.reserved_count),
  ]).toEqual([0, 3, 0]);

  const orphanId = crypto.randomUUID(),
    orphan = `${base}/${orphanId}`;
  expect(
    (await call(orphan, { method: 'PUT', token: userToken, body: input }))
      .status,
  ).toBe(200);
  await options.stage(orphanId, 'abc');
  await query(
    'UPDATE upload_intents SET created_at = ?, expires_at = ? WHERE id = ?',
    [Date.now() - 500000, Date.now() - 400000, orphanId],
  );
  expect(
    (
      await call(`${orphan}/capability`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(410);
  await expect(options.cleanup(orphanId, true)).rejects.toThrow();
  expect(
    Number(
      (
        await query(
          'SELECT reserved_bytes FROM project_upload_usage WHERE project_id = ?',
          [projectId],
        )
      )[0]!.reserved_bytes,
    ),
  ).toBe(4);
  await options.cleanup(orphanId, false);
  await options.stage(orphanId, 'late');
  await options.cleanup(orphanId, false);
  expect(
    (
      await query(
        'SELECT reservation_state, lease_id FROM upload_intent_details WHERE intent_id = ?',
        [orphanId],
      )
    )[0],
  ).toEqual({ reservation_state: 'released', lease_id: null });
  expect(
    Number(
      (
        await query(
          'SELECT reserved_bytes FROM project_upload_usage WHERE project_id = ?',
          [projectId],
        )
      )[0]!.reserved_bytes,
    ),
  ).toBe(0);
  // Multipart session orchestration uses native local R2/S3 emulation; URLs are only inspected.
  const multiId = crypto.randomUUID(),
    multi = `${base}/${multiId}`,
    mp = `${multi}/multipart`;
  const partBytes = 5 * 1024 ** 2,
    maximum = 8 * 1024 ** 2;
  expect(
    (
      await call(multi, {
        method: 'PUT',
        token: userToken,
        body: { ...input, maxBytes: maximum },
      })
    ).status,
  ).toBe(200);
  expect(await (await call(multi, { token: userToken })).json()).toMatchObject({
    transfer: { mode: 'multipart', partBytes, maxParts: 2 },
  });
  expect(
    (
      await call(`${multi}/capability`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await call(`${multi}/finalize`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(409);
  expect((await call(mp, { method: 'POST', token, body: {} })).status).toBe(
    404,
  );
  const starts = await Promise.all(
    Array.from({ length: 8 }, () =>
      call(mp, { method: 'POST', token: userToken, body: {} }),
    ),
  );
  expect(starts.some((r) => r.status === 200)).toBe(true);
  expect(starts.every((r) => r.status === 200 || r.status === 409)).toBe(true);
  const resumed = await call(mp, {
    method: 'POST',
    token: userToken,
    body: {},
  });
  expect(resumed.status).toBe(200);
  let session = (await resumed.json()) as MultipartDocument;
  expect(session.state).toBe('active');
  for (const privateField of [
    'uploadId',
    'providerUploadId',
    'stagingKey',
    'leaseId',
    'principalId',
  ])
    expect(session).not.toHaveProperty(privateField);
  for (const partNumber of [1, 2]) {
    const response = await call(`${mp}/parts/${partNumber}/capability`, {
      method: 'POST',
      token: userToken,
      body: {},
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const partCapability = (await response.json()) as UploadCapabilityDocument;
    expect(new URL(partCapability.url).searchParams.get('partNumber')).toBe(
      String(partNumber),
    );
    expect(new URL(partCapability.url).searchParams.get('X-Amz-Expires')).toBe(
      '300',
    );
    expect(
      (
        await call(`${mp}/parts/${partNumber}/capability`, {
          method: 'POST',
          token,
          body: {},
        })
      ).status,
    ).toBe(404);
    const part = await options.stagePart(
      multiId,
      partNumber,
      partNumber === 1 ? partBytes : 1024 ** 2,
    );
    const body = { ...part, expectedRevision: session.revision };
    const responsePart = await call(`${mp}/parts/${partNumber}`, {
      method: 'PUT',
      token: userToken,
      body,
    });
    expect(responsePart.status).toBe(200);
    session = (await responsePart.json()) as MultipartDocument;
    expect(
      (
        await call(`${mp}/parts/${partNumber}`, {
          method: 'PUT',
          token: userToken,
          body,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(`${mp}/parts/${partNumber}`, {
          method: 'PUT',
          token: userToken,
          body: { ...body, etag: 'changed' },
        })
      ).status,
    ).toBe(409);
  }
  expect(
    (
      await call(`${mp}/parts/3/capability`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(400);
  await options.failCompletion(multiId);
  const crashed = await call(`${mp}/complete`, {
    method: 'POST',
    token: userToken,
    body: { expectedRevision: session.revision },
  });
  expect(crashed.status).toBe(503);
  expect(JSON.stringify(await crashed.json())).not.toContain(
    'private-completion-fixture',
  );
  session = (await (
    await call(mp, { token: userToken })
  ).json()) as MultipartDocument;
  expect(session.state).toBe('completing');
  expect(
    (
      await call(`${mp}/parts/1/capability`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(409);
  await query(
    'UPDATE upload_intent_details SET lease_expires_at = ? WHERE intent_id = ?',
    [Date.now() - 1, multiId],
  );
  const completed = await call(`${mp}/complete`, {
    method: 'POST',
    token: userToken,
    body: { expectedRevision: session.revision },
  });
  expect(completed.status).toBe(202);
  expect(await completed.json()).toMatchObject({
    state: 'awaiting-processing',
    scanStatus: 'unscanned',
  });
  expect(
    (
      await call(`${mp}/complete`, {
        method: 'POST',
        token: userToken,
        body: { expectedRevision: session.revision },
      })
    ).status,
  ).toBe(202);
  await options.process(multiId);
  expect(await (await call(multi, { token: userToken })).json()).toMatchObject({
    state: 'quarantined',
    scanStatus: 'unscanned',
    actualBytes: 6 * 1024 ** 2,
  });
  await options.stage(multiId, 'evil');
  await options.process(multiId);
  expect(await options.finalSize(multiId)).toBe(6 * 1024 ** 2);

  // A receipt is a claim, so reject a provider object whose actual size differs.
  const badId = crypto.randomUUID(),
    bad = `${base}/${badId}`,
    badMp = `${bad}/multipart`;
  expect(
    (
      await call(bad, {
        method: 'PUT',
        token: userToken,
        body: { ...input, maxBytes: maximum },
      })
    ).status,
  ).toBe(200);
  let badSession = (await (
    await call(badMp, { method: 'POST', token: userToken, body: {} })
  ).json()) as MultipartDocument;
  const actual = await options.stagePart(badId, 1, 2);
  badSession = (await (
    await call(`${badMp}/parts/1`, {
      method: 'PUT',
      token: userToken,
      body: {
        expectedRevision: badSession.revision,
        etag: actual.etag,
        sizeBytes: 1,
      },
    })
  ).json()) as MultipartDocument;
  expect(
    (
      await call(`${badMp}/complete`, {
        method: 'POST',
        token: userToken,
        body: { expectedRevision: badSession.revision },
      })
    ).status,
  ).toBe(400);
  expect(await (await call(bad, { token: userToken })).json()).toMatchObject({
    state: 'rejected',
    scanStatus: 'unscanned',
  });
  await query(
    'UPDATE upload_intents SET created_at = ?, expires_at = ? WHERE id = ?',
    [Date.now() - 500000, Date.now() - 400000, badId],
  );
  await options.cleanup(badId, false);

  const abortId = crypto.randomUUID(),
    abort = `${base}/${abortId}`,
    abortMp = `${abort}/multipart`;
  expect(
    (
      await call(abort, {
        method: 'PUT',
        token: userToken,
        body: { ...input, maxBytes: maximum },
      })
    ).status,
  ).toBe(200);
  expect(
    (await call(abortMp, { method: 'POST', token: userToken, body: {} }))
      .status,
  ).toBe(200);
  await options.stagePart(abortId, 1, 2);
  expect(
    (
      await call(`${abortMp}/abort`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(`${abortMp}/abort`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(`${abortMp}/parts/1/capability`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(409);
  expect(
    Number(
      (
        await query(
          'SELECT reserved_bytes FROM project_upload_usage WHERE project_id = ?',
          [projectId],
        )
      )[0]!.reserved_bytes,
    ),
  ).toBe(maximum);
  await query(
    'UPDATE upload_intents SET created_at = ?, expires_at = ? WHERE id = ?',
    [Date.now() - 500000, Date.now() - 400000, abortId],
  );
  await options.cleanup(abortId, false);
  await options.cleanup(abortId, false);
  expect(
    Number(
      (
        await query(
          'SELECT reserved_bytes FROM project_upload_usage WHERE project_id = ?',
          [projectId],
        )
      )[0]!.reserved_bytes,
    ),
  ).toBe(0);
  expect(
    Number(
      (
        await query(
          'SELECT used_bytes FROM project_upload_usage WHERE project_id = ?',
          [projectId],
        )
      )[0]!.used_bytes,
    ),
  ).toBe(3 + 6 * 1024 ** 2);
  // Synthetic hook proves guards/runtime integration only, never malware detection.
  await options.syntheticScan(id, true);
  expect(await (await call(path, { token: userToken })).json()).toMatchObject({
    scanStatus: 'failed',
    policyState: 'quarantined',
    state: 'quarantined',
  });
  await options.syntheticScan(id, false);
  const scanResponse = await call(path, { token: userToken });
  const scanView = await scanResponse.json();
  expect(scanView).toMatchObject({
    scanStatus: 'clean',
    policyState: 'ready',
    state: 'ready',
    actualBytes: 3,
  });
  for (const field of [
    'scan',
    'scanEvidence',
    'engine',
    'signatureVersion',
    'sha256',
  ])
    expect(scanView).not.toHaveProperty(field);
  expect(
    (
      await call(`${path}/finalize`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(200);
  await options.syntheticScan(multiId, false);
  expect(await (await call(multi, { token: userToken })).json()).toMatchObject({
    scanStatus: 'clean',
    policyState: 'ready',
    state: 'ready',
    actualBytes: 6 * 1024 ** 2,
  });
  const logs = await options.observations();
  expect(logs).not.toContain(capability.url);
  expect(logs).not.toContain('X-Amz-Signature');
  expect(logs).not.toContain('private-signer-token-fixture');
  // Current project visibility applies to read and issuance, including after verification.
  await query("UPDATE projects SET visibility = 'private' WHERE id = ?", [
    projectId,
  ]);
  expect((await call(path, { token: userToken })).status).toBe(404);
  expect((await call(mp, { token: userToken })).status).toBe(404);
  expect(
    (
      await call(`${mp}/parts/1/capability`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await call(`${path}/capability`, {
        method: 'POST',
        token: userToken,
        body: {},
      })
    ).status,
  ).toBe(404);
}
