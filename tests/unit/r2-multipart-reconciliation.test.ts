import { expect, it, vi } from 'vitest';
import { createR2MultipartReconciler } from '@hyperbug/blob-r2';
import { blobKey } from '../fixtures/blob-store-proof.ts';

const config = {
  accountId: '0'.repeat(32),
  bucket: 'test-bucket',
  credentials: { accessKeyId: 'test-key', secretAccessKey: 'test-secret' },
};
const xml = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><ListMultipartUploadsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${inner}</ListMultipartUploadsResult>`;
const page = (inner = '') =>
  new Response(xml(`<IsTruncated>false</IsTruncated>${inner}`));
const scope = (key: string, signal = new AbortController().signal) => ({
  key,
  signal,
});
function fixtures(responses: Response[]) {
  const calls: Request[] = [];
  const reconciler = createR2MultipartReconciler(config, async (request) => {
    calls.push(request);
    const response = responses.shift();
    if (!response) throw new Error('Unexpected private provider request');
    return response;
  });
  return { calls, reconciler };
}
it.each([true, false])(
  'signs bounded exact-key pages and aborts with a key marker present: %s',
  async (keyMarker) => {
    const key = blobKey(),
      escaped = 'one&amp;+&quot;&lt;&gt;',
      id = 'one&+"<>';
    const f = fixtures([
      new Response(
        xml(
          `<Bucket>test-bucket</Bucket><Prefix>${key}</Prefix><IsTruncated>true</IsTruncated>${keyMarker ? `<NextKeyMarker>${key}</NextKeyMarker>` : ''}<NextUploadIdMarker>${escaped}</NextUploadIdMarker><Upload><Key>${key.replace('/', '&#x2f;')}</Key><UploadId>${escaped}</UploadId><Owner><ID>ignored</ID></Owner></Upload>`,
        ),
      ),
      page(`<Upload><Key>${key}</Key><UploadId>two</UploadId></Upload>`),
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
      page(),
    ]);
    expect(await f.reconciler.reconcile(scope(key))).toEqual({
      key,
      remainingUploads: 0,
    });
    expect(f.calls).toHaveLength(5);
    for (const request of f.calls) {
      expect(request.redirect).toBe('manual');
      expect(request.headers.get('authorization')).toMatch(
        /^AWS4-HMAC-SHA256 /,
      );
      expect(new URL(request.url).search).not.toContain('X-Amz-');
      expect(new URL(request.url).origin).toBe(
        `https://${config.accountId}.r2.cloudflarestorage.com`,
      );
    }
    const first = new URL(f.calls[0]!.url),
      next = new URL(f.calls[1]!.url);
    expect(first.pathname).toBe('/test-bucket');
    expect(first.searchParams.get('prefix')).toBe(key);
    expect(first.searchParams.get('max-uploads')).toBe('20');
    expect(next.searchParams.get('key-marker')).toBe(keyMarker ? key : null);
    expect(next.searchParams.get('upload-id-marker')).toBe(id);
    expect(new URL(f.calls[2]!.url).searchParams.get('uploadId')).toBe(id);
  },
);
it('accepts only the specific absent-session error before complete post-abort absence', async () => {
  const key = blobKey(),
    first = () =>
      page(`<Upload><Key>${key}</Key><UploadId>one</UploadId></Upload>`);
  const f = fixtures([
    first(),
    new Response(
      '<Error><Code>NoSuchUpload</Code><Message>private</Message></Error>',
      { status: 404 },
    ),
    page(),
  ]);
  expect(await f.reconciler.reconcile(scope(key))).toEqual({
    key,
    remainingUploads: 0,
  });
  const other = fixtures([
    first(),
    new Response('<Error><Code>AccessDenied</Code></Error>', { status: 404 }),
  ]);
  await expect(other.reconciler.reconcile(scope(key))).rejects.toMatchObject({
    code: 'BLOB_UNAVAILABLE',
  });
  expect(other.calls).toHaveLength(2);
});
const invalid = [
  ['wrong root', '<Error><IsTruncated>false</IsTruncated></Error>'],
  ['missing terminal status', xml('')],
  [
    'ambiguous terminal status',
    xml('<IsTruncated>false</IsTruncated><IsTruncated>true</IsTruncated>'),
  ],
  [
    'wrong namespace',
    '<ListMultipartUploadsResult xmlns="https://evil.example"><IsTruncated>false</IsTruncated></ListMultipartUploadsResult>',
  ],
  [
    'DTD/entity declaration',
    '<!DOCTYPE x [<!ENTITY x "private">]>' +
      xml('<IsTruncated>false</IsTruncated>'),
  ],
  [
    'custom entity',
    xml(
      '<IsTruncated>false</IsTruncated><NextUploadIdMarker>&secret;</NextUploadIdMarker>',
    ),
  ],
  [
    'control entity',
    xml(
      '<IsTruncated>false</IsTruncated><NextUploadIdMarker>&#0;</NextUploadIdMarker>',
    ),
  ],
  [
    'surrogate entity',
    xml(
      '<IsTruncated>false</IsTruncated><NextUploadIdMarker>&#xD800;</NextUploadIdMarker>',
    ),
  ],
  ['mixed content', xml('private<IsTruncated>false</IsTruncated>')],
  [
    'unbalanced structure',
    '<ListMultipartUploadsResult><IsTruncated>false</ListMultipartUploadsResult>',
  ],
  ['multiple roots', xml('<IsTruncated>false</IsTruncated>') + xml('')],
  ['grouped prefix', xml('<IsTruncated>false</IsTruncated><CommonPrefixes/>')],
  [
    'too many nodes',
    xml('<IsTruncated>false</IsTruncated>' + '<Unknown/>'.repeat(1024)),
  ],
  [
    'too deep',
    xml(
      '<IsTruncated>false</IsTruncated>' +
        '<Nested>'.repeat(8) +
        '</Nested>'.repeat(8),
    ),
  ],
] as const;
it.each(invalid)(
  'rejects %s without issuing an abort or leaking response details',
  async (_, body) => {
    const f = fixtures([new Response(body)]);
    await expect(
      f.reconciler.reconcile(scope(blobKey())),
    ).rejects.toMatchObject({ message: 'BLOB_UNAVAILABLE' });
    expect(f.calls).toHaveLength(1);
  },
);
it('refuses malformed UTF-8, duplicate upload fields and wrong bucket/prefix/key', async () => {
  const key = blobKey();
  const cases = [
    new Response(new Uint8Array([0xff])),
    page('<Bucket>other-bucket</Bucket>'),
    page(`<Prefix>${blobKey()}</Prefix>`),
    page(`<Upload><Key>${blobKey()}</Key><UploadId>one</UploadId></Upload>`),
    page(
      `<Upload><Key>${key}</Key><UploadId>one</UploadId><UploadId>two</UploadId></Upload>`,
    ),
  ];
  for (const response of cases) {
    const f = fixtures([response]);
    // Independent protocol refusals are verified in order.
    // eslint-disable-next-line no-await-in-loop
    await expect(f.reconciler.reconcile(scope(key))).rejects.toMatchObject({
      code: 'BLOB_UNAVAILABLE',
    });
    expect(f.calls).toHaveLength(1);
  }
});
it.each([true, false])(
  'bounds/cancels an excessive XML body; Content-Length supplied: %s',
  async (length) => {
    let pulled = 0,
      cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled++;
          controller.enqueue(new Uint8Array(128 * 1024 + 1));
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const f = fixtures([
      new Response(body, {
        headers: length ? { 'content-length': String(128 * 1024 + 1) } : {},
      }),
    ]);
    await expect(
      f.reconciler.reconcile(scope(blobKey())),
    ).rejects.toMatchObject({ code: 'BLOB_UNAVAILABLE' });
    expect(cancelled).toBe(true);
    expect(pulled).toBe(length ? 0 : 1);
  },
);
it('rejects non-success status without buffering a private provider error body', async () => {
  let cancelled = false;
  const body = new ReadableStream(
    {
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const f = fixtures([new Response(body, { status: 403 })]);
  await expect(f.reconciler.reconcile(scope(blobKey()))).rejects.toMatchObject({
    message: 'BLOB_UNAVAILABLE',
  });
  expect(cancelled).toBe(true);
});
it.each([301, 302, 303, 307, 308])(
  'refuses redirect %s without following or buffering its body',
  async (status) => {
    let cancelled = false;
    const body = new ReadableStream(
      {
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const f = fixtures([
      new Response(body, {
        status,
        headers: { location: 'https://unapproved.example/' },
      }),
    ]);
    await expect(
      f.reconciler.reconcile(scope(blobKey())),
    ).rejects.toMatchObject({ message: 'BLOB_UNAVAILABLE' });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.redirect).toBe('manual');
    expect(cancelled).toBe(true);
  },
);
it('returns within the deadline, cancels a late response and never starts an abort', async () => {
  vi.useFakeTimers();
  try {
    let late: (response: Response) => void = () => {},
      cancelled = false;
    const transport = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          late = resolve;
        }),
    );
    const pending = createR2MultipartReconciler(config, transport).reconcile(
      scope(blobKey()),
    );
    const refused = expect(pending).rejects.toMatchObject({
      code: 'BLOB_UNAVAILABLE',
    });
    // Web Crypto signing uses real asynchronous I/O; start the request before the fake deadline.
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(30001);
    await refused;
    late(
      new Response(
        new ReadableStream(
          {
            cancel() {
              cancelled = true;
            },
          },
          { highWaterMark: 0 },
        ),
      ),
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(cancelled).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
it('cancels a stalled body on caller abort and refuses an already-aborted caller before I/O', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        return new Promise(() => {});
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const controller = new AbortController(),
    transport = vi.fn(async () => new Response(body));
  const pending = createR2MultipartReconciler(config, transport).reconcile(
    scope(blobKey(), controller.signal),
  );
  const rejected = expect(pending).rejects.toMatchObject({
    code: 'BLOB_UNAVAILABLE',
  });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  controller.abort();
  await rejected;
  expect(cancelled).toBe(true);
  const never = vi.fn();
  await expect(
    createR2MultipartReconciler(config, never).reconcile(
      scope(blobKey(), controller.signal),
    ),
  ).rejects.toMatchObject({ code: 'BLOB_UNAVAILABLE' });
  expect(never).not.toHaveBeenCalled();
});
