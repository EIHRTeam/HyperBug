import { expect, it } from 'vitest';
import { createR2LegacyRecoveryProvider } from '@hyperbug/blob-r2';
import { r2LegacyApproval } from '../fixtures/r2-legacy-provider-proof.ts';

// Planned 07.3h/V4 trusted provenance, exact addressing, provider uncertainty and wait bounds.
const config = {
  accountId: '0'.repeat(32),
  bucket: 'test-bucket',
  credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
};
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const row = (key: string, id = 'one') =>
  `<Upload><Key>${escape(key)}</Key><UploadId>${id}</UploadId></Upload>`;
const page = (inner = '', truncated = false) =>
  new Response(
    `<ListMultipartUploadsResult><IsTruncated>${truncated}</IsTruncated>${inner}</ListMultipartUploadsResult>`,
  );
const absent = () => new Response(null, { status: 404 });
const deleted = () => new Response(null, { status: 204 });
async function fixture(
  responses: Response[] | ((key: string) => Response[]),
  key?: string,
) {
  const approval = await r2LegacyApproval(config, key);
  const actual = approval.decision.snapshot.objectKey;
  const pending =
    typeof responses === 'function' ? responses(actual) : responses;
  const calls: Request[] = [];
  const adapter = await createR2LegacyRecoveryProvider(
    config,
    approval,
    async (request) => {
      calls.push(request);
      const response = pending.shift();
      if (!response) throw new Error('Unexpected synthetic provider request');
      return response;
    },
  );
  const recover = (signal = AbortSignal.timeout(1000)) =>
    adapter.provider.recover({ decision: approval.decision, signal });
  return { approval, calls, adapter, recover, key: actual };
}

it('reconciles exact Unicode/reserved-character keys, validates bounded pages and preserves prefix siblings', async () => {
  const f = await fixture((key) => [
    page(
      `${row(key)}<NextKeyMarker>${escape(key)}</NextKeyMarker><NextUploadIdMarker>one</NextUploadIdMarker>`,
      true,
    ),
    page(row(`${key}-sibling`, 'sibling')),
    deleted(),
    deleted(),
    absent(),
    page(row(`${key}-sibling`, 'sibling')),
  ]);
  try {
    expect(await f.recover()).toMatchObject({
      key: f.key,
      remainingObjects: 0,
      remainingUploads: 0,
    });
    expect(f.calls).toHaveLength(6);
    for (const request of f.calls) {
      expect(request.redirect).toBe('manual');
      expect(request.cache).toBe('no-store');
      expect(request.headers.get('authorization')).toMatch(
        /^AWS4-HMAC-SHA256 /,
      );
      const url = new URL(request.url);
      expect(url.origin).toBe(
        `https://${config.accountId}.r2.cloudflarestorage.com`,
      );
      expect(url.searchParams.has('X-Amz-Credential')).toBe(false);
      if (request.method !== 'GET')
        expect(decodeURIComponent(url.pathname)).toBe(
          `/${config.bucket}/${f.key}`,
        );
    }
    expect(new URL(f.calls[0]!.url).searchParams.get('prefix')).toBe(f.key);
    expect(new URL(f.calls[0]!.url).searchParams.get('max-uploads')).toBe('20');
    expect(new URL(f.calls[1]!.url).searchParams.get('key-marker')).toBe(f.key);
    expect(new URL(f.calls[2]!.url).searchParams.get('uploadId')).toBe('one');
  } finally {
    f.adapter.close();
  }
});

it.each([
  'digest',
  'destination',
  'snapshot',
  'accounting',
  'policy',
  'extra',
  'invalid-utf8',
  'oversize',
])('refuses unverified original manifest before I/O: %s', async (kind) => {
  const approval = await r2LegacyApproval(config);
  let calls = 0;
  if (kind === 'digest') approval.ownershipEvidence[0] = 0;
  else if (kind === 'oversize')
    approval.ownershipEvidence = new Uint8Array(16385);
  else {
    const accounting = kind === 'accounting';
    const bytes = accounting
      ? approval.accountingEvidence
      : approval.ownershipEvidence;
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (kind === 'destination') value.bucket = 'wrong-bucket';
    if (kind === 'snapshot') value.snapshot.id = crypto.randomUUID();
    if (accounting) value.retained.reservedBytes++;
    if (kind === 'policy') value.absencePolicy = 'generic-head-only';
    if (kind === 'extra') value.arbitraryKey = 'wrong';
    const changed =
      kind === 'invalid-utf8'
        ? new Uint8Array([0xff])
        : new TextEncoder().encode(JSON.stringify(value));
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', changed)),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
    if (accounting) {
      approval.accountingEvidence = changed;
      approval.decision.accountingEvidenceSha256 = hash;
    } else {
      approval.ownershipEvidence = changed;
      approval.decision.ownershipEvidenceSha256 = hash;
    }
  }
  await expect(
    createR2LegacyRecoveryProvider(config, approval, async () => {
      calls++;
      return page();
    }),
  ).rejects.toThrow();
  expect(calls).toBe(0);
});

it.each([
  'legacy/../other',
  'legacy/./other',
  '/legacy',
  'legacy//other',
  'legacy\\other',
])('refuses ambiguous historical addressing before I/O: %s', async (key) => {
  const approval = await r2LegacyApproval(config, key);
  await expect(
    createR2LegacyRecoveryProvider(config, approval),
  ).rejects.toThrow();
});

it.each([
  'redirect',
  'provider-error',
  'wrong-prefix',
  'duplicates',
  'mixed-missing-marker',
  'oversize-body',
  'DTD',
])(
  'retains policy before mutations when discovery is uncertain: %s',
  async (kind) => {
    const f = await fixture((key) => [
      kind === 'redirect'
        ? new Response(null, {
            status: 307,
            headers: { location: 'https://evil.example' },
          })
        : kind === 'provider-error'
          ? new Response(null, { status: 403 })
          : kind === 'wrong-prefix'
            ? page(row('unowned'))
            : kind === 'duplicates'
              ? page(row(key) + row(key))
              : kind === 'mixed-missing-marker'
                ? page(
                    `${row(`${key}-sibling`)}<NextUploadIdMarker>one</NextUploadIdMarker>`,
                    true,
                  )
                : kind === 'oversize-body'
                  ? new Response(' '.repeat(131073))
                  : new Response('<!DOCTYPE root><root/>'),
    ]);
    try {
      await expect(f.recover()).rejects.toMatchObject({
        code: 'UPLOAD_UNAVAILABLE',
      });
    } finally {
      f.adapter.close();
    }
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.method).toBe('GET');
  },
);

it.each(['abort', 'delete', 'head', 'late'])(
  'fails closed on physical mutation/absence uncertainty: %s',
  async (kind) => {
    const f = await fixture((key) => [
      page(row(key)),
      kind === 'abort'
        ? new Response('<Error><Code>AccessDenied</Code></Error>', {
            status: 404,
          })
        : deleted(),
      kind === 'delete' ? new Response(null, { status: 403 }) : deleted(),
      kind === 'head' ? new Response(null, { status: 200 }) : absent(),
      page(row(key, 'late')),
    ]);
    try {
      await expect(f.recover()).rejects.toMatchObject({
        code: 'UPLOAD_UNAVAILABLE',
      });
    } finally {
      f.adapter.close();
    }
    expect(f.calls.length).toBeLessThanOrEqual(5);
  },
);

it('accepts only a specific absent-session error and supports repeated retained-decision sweeps', async () => {
  const f = await fixture((key) => [
    page(row(key)),
    new Response('<Error><Code>NoSuchUpload</Code></Error>', { status: 404 }),
    deleted(),
    absent(),
    page(),
    page(),
    deleted(),
    absent(),
    page(),
  ]);
  try {
    expect((await f.recover()).remainingUploads).toBe(0);
    expect((await f.recover()).remainingObjects).toBe(0);
  } finally {
    f.adapter.close();
  }
});

it('caps discovery at five pages before any mutation', async () => {
  const f = await fixture((key) =>
    Array.from({ length: 5 }, (_, index) =>
      page(
        `${row(key, `id-${index}`)}<NextKeyMarker>${escape(key)}</NextKeyMarker><NextUploadIdMarker>id-${index}</NextUploadIdMarker>`,
        true,
      ),
    ),
  );
  try {
    await expect(f.recover()).rejects.toMatchObject({
      code: 'UPLOAD_UNAVAILABLE',
    });
  } finally {
    f.adapter.close();
  }
  expect(f.calls).toHaveLength(5);
  expect(f.calls.every((request) => request.method === 'GET')).toBe(true);
});

it('enforces real elapsed retention, one active operation, cancellation and closed capability', async () => {
  let calls = 0;
  const early = await r2LegacyApproval(config, undefined, Date.now() + 60000);
  const held = await createR2LegacyRecoveryProvider(config, early, async () => {
    calls++;
    return page();
  });
  await expect(
    held.provider.recover({
      decision: early.decision,
      signal: AbortSignal.timeout(1000),
    }),
  ).rejects.toThrow();
  held.close();
  expect(calls).toBe(0);
  const approval = await r2LegacyApproval(config);
  const adapter = await createR2LegacyRecoveryProvider(
    config,
    approval,
    async () => {
      calls++;
      return new Promise(() => {});
    },
  );
  try {
    const pending = expect(
      adapter.provider.recover({
        decision: approval.decision,
        signal: AbortSignal.timeout(75),
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
    await expect(
      adapter.provider.recover({
        decision: approval.decision,
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow();
    await pending;
    expect(calls).toBe(1);
  } finally {
    adapter.close();
  }
  await expect(
    adapter.provider.recover({
      decision: approval.decision,
      signal: AbortSignal.timeout(1000),
    }),
  ).rejects.toThrow();
});
