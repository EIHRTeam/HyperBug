import { afterEach, beforeEach, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import {
  createS3LegacyRecoveryProvider,
  type S3LegacyRecoveryApproval,
} from '@hyperbug/blob-s3';
import {
  legacyProviderApproval,
  type LegacyProviderConfig,
} from '../fixtures/upload-legacy-provider-proof.ts';

// Planned 07.3h/V4 provenance, provider failure, resource bounds, sibling and retry cases.
// HTTP responses below are synthetic; they never prove real physical recovery.
let server: Server,
  config: LegacyProviderConfig,
  approval: S3LegacyRecoveryApproval;
let requests: { method: string; path: string; operation: string }[];
let mode: string, exists: boolean, listCalls: number, aborts: string[];
const emptyVersion =
  '<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>';
const xmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const list = (key: string, ids: string[], truncated = false, nextId?: string) =>
  `<ListMultipartUploadsResult><IsTruncated>${truncated}</IsTruncated>${ids
    .map(
      (id) =>
        `<Upload><Key>${xmlEscape(key)}</Key><UploadId>${id}</UploadId></Upload>`,
    )
    .join(
      '',
    )}${nextId ? `<NextUploadIdMarker>${nextId}</NextUploadIdMarker>` : ''}</ListMultipartUploadsResult>`;
beforeEach(async () => {
  requests = [];
  mode = 'ok';
  exists = true;
  listCalls = 0;
  aborts = [];
  server = createServer((request, response) => {
    const url = new URL(request.url!, 'http://localhost');
    const operation = url.searchParams.has('versioning')
      ? 'version'
      : url.searchParams.has('uploads')
        ? 'list'
        : url.searchParams.has('uploadId')
          ? 'abort'
          : request.method === 'HEAD'
            ? 'head'
            : 'delete';
    requests.push({
      method: request.method!,
      path: decodeURIComponent(url.pathname),
      operation,
    });
    response.setHeader('content-type', 'application/xml');
    if (operation === 'version') {
      if (mode === 'stall') return;
      if (mode === 'unsupported') {
        response.statusCode = 501;
        response.end('<Error><Code>NotImplemented</Code></Error>');
        return;
      }
      if (mode === 'oversize-header') {
        response.setHeader('content-length', 131073);
        response.end();
        return;
      }
      if (mode === 'oversize-stream') {
        response.write(' '.repeat(131073));
        response.end();
        return;
      }
      response.end(
        mode === 'unknown-root'
          ? '<WrongRoot/>'
          : ['Enabled', 'Suspended', 'Unknown'].includes(mode)
            ? `<VersioningConfiguration><Status>${mode}</Status></VersioningConfiguration>`
            : emptyVersion,
      );
    } else if (operation === 'list') {
      listCalls++;
      const key = approval.decision.snapshot.objectKey;
      if (mode === 'invalid-list-utf8') {
        response.end(Buffer.from([0xff]));
        return;
      }
      if (mode === 'mixed') {
        const sibling = `<Upload><Key>${xmlEscape(key)}-sibling</Key><UploadId>sibling</UploadId></Upload>`;
        response.end(
          listCalls === 1
            ? list(key, ['first'], true, 'first').replace(
                '<Upload>',
                `${sibling}<Upload>`,
              )
            : listCalls === 2
              ? list(key, [])
              : list(`${key}-sibling`, ['sibling']),
        );
        return;
      }
      if (mode === 'pages')
        response.end(
          list(key, [`page-${listCalls}`], true, `page-${listCalls}`),
        );
      else if (mode === 'repeat')
        response.end(list(key, ['same'], true, 'same'));
      else if (mode === 'unrelated')
        response.end(list('unowned-other-key', ['private-session']));
      else if (mode === 'late' && listCalls > 1)
        response.end(list(key, ['late']));
      else if (listCalls === 1) response.end(list(key, ['first']));
      else response.end(list(`${key}-sibling`, ['sibling']));
    } else if (operation === 'abort') {
      aborts.push(url.searchParams.get('uploadId')!);
      if (mode === 'abort-failure') {
        response.statusCode = 403;
        response.end('<Error><Code>AccessDenied</Code></Error>');
      } else response.end();
    } else if (operation === 'delete') {
      if (mode !== 'head-exists') exists = false;
      response.statusCode = 204;
      response.end();
    } else {
      response.statusCode = exists ? 200 : 404;
      if (exists) {
        response.setHeader('content-length', 3);
        response.setHeader('etag', '"old"');
      }
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing loopback fixture port');
  config = {
    endpoint: `http://127.0.0.1:${address.port}`,
    bucket: 'legacy-test',
    region: 'us-east-1',
    forcePathStyle: true,
    allowLocalHttp: true,
    credentials: {
      accessKeyId: 'local-test',
      secretAccessKey: 'synthetic-local-test',
    },
  };
  approval = legacyProviderApproval(config);
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
const recover = (
  adapter: ReturnType<typeof createS3LegacyRecoveryProvider>,
  signal = AbortSignal.timeout(5000),
) => adapter.provider.recover({ decision: approval.decision, signal });

it('retains exact physical targets until explicit retention elapses even for an approved decision', async () => {
  approval = legacyProviderApproval(config, undefined, Date.now() + 60000);
  const adapter = createS3LegacyRecoveryProvider(config, approval);
  try {
    await expect(recover(adapter)).rejects.toMatchObject({
      code: 'UPLOAD_UNAVAILABLE',
    });
  } finally {
    adapter.close();
  }
  expect(requests).toHaveLength(0);
  expect(exists).toBe(true);
});

it('binds the approval before network access and preserves exact Unicode key and prefix sibling', async () => {
  const adapter = createS3LegacyRecoveryProvider(config, approval);
  // Mutating caller input cannot retarget fixed destination or decision.
  config.bucket = 'different';
  try {
    expect(await recover(adapter)).toMatchObject({
      key: approval.decision.snapshot.objectKey,
      remainingObjects: 0,
      remainingUploads: 0,
    });
    expect(aborts).toEqual(['first']);
    expect(requests.map((row) => row.operation)).toEqual([
      'version',
      'list',
      'abort',
      'delete',
      'head',
      'list',
      'version',
    ]);
    expect(
      requests
        .filter((row) => ['abort', 'delete', 'head'].includes(row.operation))
        .every(
          (row) =>
            row.path === `/legacy-test/${approval.decision.snapshot.objectKey}`,
        ),
    ).toBe(true);
    listCalls = 0;
    exists = true;
    expect((await recover(adapter)).remainingObjects).toBe(0);
  } finally {
    adapter.close();
  }
});

it.each([
  'hash',
  'destination',
  'snapshot',
  'accounting',
  'extra-field',
  'invalid-json',
  'oversize-manifest',
  'continuation-mode',
])('rejects unverified or mismatched manifest before I/O: %s', (variant) => {
  if (variant === 'hash') approval.ownershipEvidence[0] = 0;
  else if (variant === 'oversize-manifest')
    approval.ownershipEvidence = new Uint8Array(16385);
  else if (variant === 'invalid-json') {
    approval.ownershipEvidence = new Uint8Array([0xff]);
    approval.decision.ownershipEvidenceSha256 = createHash('sha256')
      .update(approval.ownershipEvidence)
      .digest('hex');
  } else if (variant === 'accounting') {
    const evidence = JSON.parse(
      new TextDecoder().decode(approval.accountingEvidence),
    );
    evidence.retained.reservedBytes++;
    approval.accountingEvidence = new TextEncoder().encode(
      JSON.stringify(evidence),
    );
    approval.decision.accountingEvidenceSha256 = createHash('sha256')
      .update(approval.accountingEvidence)
      .digest('hex');
  } else {
    const evidence = JSON.parse(
      new TextDecoder().decode(approval.ownershipEvidence),
    );
    if (variant === 'destination') evidence.bucket = 'wrong-bucket';
    if (variant === 'snapshot') evidence.snapshot.id = crypto.randomUUID();
    if (variant === 'extra-field') evidence.arbitraryKey = 'wrong';
    if (variant === 'continuation-mode')
      evidence.multipartContinuation = 'seaweedfs-4.48';
    approval.ownershipEvidence = new TextEncoder().encode(
      JSON.stringify(evidence),
    );
    approval.decision.ownershipEvidenceSha256 = createHash('sha256')
      .update(approval.ownershipEvidence)
      .digest('hex');
  }
  expect(() => createS3LegacyRecoveryProvider(config, approval)).toThrow();
  expect(requests).toHaveLength(0);
});

it.each([
  'legacy/../other',
  'legacy/./other',
  '/legacy',
  'legacy//other',
  'legacy\\other',
])('refuses ambiguous historical path before I/O: %s', (key) => {
  approval = legacyProviderApproval(config, key);
  expect(() => createS3LegacyRecoveryProvider(config, approval)).toThrow();
  expect(requests).toHaveLength(0);
});

it.each([
  'Enabled',
  'Suspended',
  'Unknown',
  'unsupported',
  'unknown-root',
  'oversize-header',
  'oversize-stream',
])(
  'retains physical targets when version/response proof is uncertain: %s',
  async (variant) => {
    mode = variant;
    const adapter = createS3LegacyRecoveryProvider(config, approval);
    try {
      await expect(recover(adapter)).rejects.toMatchObject({
        code: 'UPLOAD_UNAVAILABLE',
      });
    } finally {
      adapter.close();
    }
    expect(requests.map((row) => row.operation)).toEqual(['version']);
    expect(exists).toBe(true);
  },
);

it.each(['s3', 'seaweedfs-4.48'] as const)(
  'binds mixed-prefix upload-ID-only continuation to the reviewed provider mode: %s',
  async (multipartContinuation) => {
    mode = 'mixed';
    config.multipartContinuation = multipartContinuation;
    approval = legacyProviderApproval(config);
    const adapter = createS3LegacyRecoveryProvider(config, approval);
    try {
      if (multipartContinuation === 's3') {
        await expect(recover(adapter)).rejects.toMatchObject({
          code: 'UPLOAD_UNAVAILABLE',
        });
        expect(requests.map((row) => row.operation)).toEqual([
          'version',
          'list',
        ]);
        expect(exists).toBe(true);
      } else {
        expect((await recover(adapter)).remainingUploads).toBe(0);
        expect(aborts).toEqual(['first']);
        expect(listCalls).toBe(3);
      }
    } finally {
      adapter.close();
    }
  },
);

it.each([
  'pages',
  'repeat',
  'unrelated',
  'abort-failure',
  'head-exists',
  'late',
  'invalid-list-utf8',
])(
  'fails closed on bounded discovery/mutation/absence uncertainty: %s',
  async (variant) => {
    mode = variant;
    const adapter = createS3LegacyRecoveryProvider(config, approval);
    try {
      await expect(recover(adapter)).rejects.toMatchObject({
        code: 'UPLOAD_UNAVAILABLE',
      });
    } finally {
      adapter.close();
    }
    expect(listCalls).toBeLessThanOrEqual(5);
    if (['pages', 'repeat', 'unrelated', 'abort-failure'].includes(mode)) {
      expect(requests.some((row) => row.operation === 'delete')).toBe(false);
      expect(exists).toBe(true);
    }
    expect(aborts).not.toContain('sibling');
  },
);

it('rejects a different decision, cancellation and closed capabilities without further provider work', async () => {
  const adapter = createS3LegacyRecoveryProvider(config, approval);
  try {
    await expect(
      adapter.provider.recover({
        decision: { ...approval.decision, decisionId: crypto.randomUUID() },
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow();
    const aborted = new AbortController();
    aborted.abort();
    await expect(recover(adapter, aborted.signal)).rejects.toThrow();
    expect(requests).toHaveLength(0);
    mode = 'stall';
    const cancelled = expect(
      recover(adapter, AbortSignal.timeout(75)),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
    await expect(recover(adapter)).rejects.toMatchObject({
      code: 'UPLOAD_UNAVAILABLE',
    });
    await cancelled;
    expect(requests.map((row) => row.operation)).toEqual(['version']);
  } finally {
    adapter.close();
  }
  await expect(recover(adapter)).rejects.toThrow();
  expect(requests).toHaveLength(1);
});
