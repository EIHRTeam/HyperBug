import { expect, it, vi } from 'vitest';
import {
  createScannerServiceClient,
  guardScannerServiceInput,
  scannerServiceProtocol,
  scannerServiceUrl,
  type AttachmentScanner,
  type ScannerServiceTransport,
  type ScannerServiceReply,
} from '@hyperbug/application';
import { createNodeBlobDigest } from '@hyperbug/blob-s3';
import { createNodeAttachmentScannerService } from '../../apps/api-node/src/attachment-scanner-service.ts';
import { syntheticClean } from '../fixtures/upload-scan-contract.ts';
const secret = 'a'.repeat(64);
it.each(['factory', 'cancel'] as const)(
  'stream guard releases its reader after %s failure',
  async (kind) => {
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        canceled = true;
        if (kind === 'cancel') throw new Error('private-cancel-error');
      },
    });
    if (kind === 'factory') {
      expect(() =>
        guardScannerServiceInput(
          stream,
          3,
          new AbortController().signal,
          () => {
            throw new Error('private-digest-error');
          },
        ),
      ).toThrow();
    } else {
      guardScannerServiceInput(
        stream,
        3,
        new AbortController().signal,
        createNodeBlobDigest,
      ).stop();
    }
    await vi.waitFor(() => expect(stream.locked).toBe(false));
    expect(canceled).toBe(true);
  },
);
const bytes = new TextEncoder().encode('abc');
const body = () =>
  new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
async function consume(stream: ReadableStream<Uint8Array>) {
  const digest = createNodeBlobDigest(),
    reader = stream.getReader();
  let sizeBytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      await digest.write(chunk.value);
      sizeBytes += chunk.value.byteLength;
    }
    return { sha256: await digest.finish(), sizeBytes };
  } finally {
    reader.releaseLock();
    await digest.abort();
  }
}
function request(input: Parameters<ScannerServiceTransport['send']>[0]) {
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    body: input.body,
    headers: input.headers,
    signal: input.signal,
    duplex: 'half',
    redirect: 'manual',
  };
  return new Request(scannerServiceUrl, init);
}
const serviceScanner: AttachmentScanner = {
  async scan(input) {
    await consume(input.body);
    return syntheticClean;
  },
};
const scan = (
  client: AttachmentScanner,
  overrides: Partial<Parameters<AttachmentScanner['scan']>[0]> = {},
) =>
  client.scan({
    body: body(),
    sizeBytes: 3,
    contentType: 'text/plain',
    signal: new AbortController().signal,
    ...overrides,
  });
function transport(
  handler: (request: Request) => Promise<Response>,
): ScannerServiceTransport {
  return {
    async send(input) {
      const response = await handler(request(input));
      return {
        status: response.status,
        contentType: response.headers.get('content-type'),
        body: response.body,
      };
    },
  };
}
it('synthetic private service binds the complete streamed bytes and fresh request to its outcome', async () => {
  const handler = createNodeAttachmentScannerService(serviceScanner, secret);
  const client = createScannerServiceClient(
    transport(handler),
    createNodeBlobDigest,
    secret,
  );
  expect(await scan(client)).toEqual(syntheticClean);
  expect(await scan(client)).toEqual(syntheticClean);
});
it.each(['missing', 'wrong', 'non-ascii', 'long'] as const)(
  'synthetic service rejects %s authentication before reading bytes or calling scanner',
  async (kind) => {
    const scanner = { scan: vi.fn(serviceScanner.scan) };
    const handler = createNodeAttachmentScannerService(scanner, secret);
    let pulled = false;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const headers = new Headers({ 'content-type': 'application/octet-stream' });
    if (kind !== 'missing')
      headers.set(
        'authorization',
        kind === 'wrong'
          ? `Bearer ${'b'.repeat(64)}`
          : kind === 'long'
            ? 'x'.repeat(200)
            : `Bearer ${'é'.repeat(64)}`,
      );
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers,
      body: stream,
      duplex: 'half',
    };
    expect((await handler(new Request(scannerServiceUrl, init))).status).toBe(
      401,
    );
    expect(scanner.scan).not.toHaveBeenCalled();
    expect(pulled).toBe(false);
  },
);
it.each([
  'protocol',
  'size',
  'type',
  'length',
  'path',
  'query',
  'encoding',
] as const)(
  'synthetic service denies invalid %s metadata before invoking scanner',
  async (kind) => {
    const scanner = { scan: vi.fn(serviceScanner.scan) },
      handler = createNodeAttachmentScannerService(scanner, secret);
    const headers = new Headers({
      authorization: `Bearer ${secret}`,
      'content-type': 'application/octet-stream',
      'x-hyperbug-scanner-protocol': scannerServiceProtocol,
      'x-hyperbug-scan-id': crypto.randomUUID(),
      'x-hyperbug-scan-size': '3',
      'x-hyperbug-scan-type': 'text/plain',
    });
    if (kind === 'protocol')
      headers.set('x-hyperbug-scanner-protocol', 'future');
    if (kind === 'size')
      headers.set('x-hyperbug-scan-size', String(32 * 1024 ** 2 + 1));
    if (kind === 'type')
      headers.set('x-hyperbug-scan-type', 'text/plain; unsafe');
    if (kind === 'length') headers.set('content-length', '4');
    if (kind === 'encoding') headers.set('content-encoding', 'gzip');
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      body: body(),
      headers,
      duplex: 'half',
    };
    const url =
      kind === 'path'
        ? scannerServiceUrl + '/other'
        : kind === 'query'
          ? scannerServiceUrl + '?x=1'
          : scannerServiceUrl;
    expect((await handler(new Request(url, init))).status).toBe(400);
    expect(scanner.scan).not.toHaveBeenCalled();
  },
);
it.each([
  'request',
  'digest',
  'size',
  'extra',
  'utf8',
  'overflow',
  'redirect',
] as const)(
  'synthetic transport refuses %s response confusion',
  async (kind) => {
    const client = createScannerServiceClient(
      {
        async send(input) {
          const identity = await consume(input.body);
          const reply: ScannerServiceReply = {
            protocol: scannerServiceProtocol,
            requestId: input.headers['x-hyperbug-scan-id']!,
            identity,
            outcome: syntheticClean,
          };
          if (kind === 'request') reply.requestId = crypto.randomUUID();
          if (kind === 'digest') reply.identity!.sha256 = '0'.repeat(64);
          if (kind === 'size') reply.identity!.sizeBytes = 4;
          const response =
            kind === 'utf8'
              ? new Response(Uint8Array.from([0xff]))
              : kind === 'overflow'
                ? new Response(' '.repeat(2049))
                : Response.json(
                    kind === 'extra'
                      ? { ...reply, private: 'unexpected' }
                      : reply,
                  );
          return {
            status: kind === 'redirect' ? 302 : 200,
            contentType: 'application/json',
            body: response.body,
          };
        },
      },
      createNodeBlobDigest,
      secret,
    );
    expect(await scan(client)).toEqual({
      status: 'failed',
      failure: ['digest', 'size'].includes(kind)
        ? 'identity'
        : kind === 'redirect'
          ? 'unavailable'
          : 'invalid-result',
    });
  },
);
it('synthetic transport cannot claim complete scanning before the request reaches EOF', async () => {
  const client = createScannerServiceClient(
    {
      async send(input) {
        return {
          status: 200,
          contentType: 'application/json',
          body: Response.json({
            protocol: scannerServiceProtocol,
            requestId: input.headers['x-hyperbug-scan-id'],
            identity: { sizeBytes: 3, sha256: '0'.repeat(64) },
            outcome: syntheticClean,
          }).body,
        };
      },
    },
    createNodeBlobDigest,
    secret,
  );
  expect(await scan(client)).toEqual({ status: 'failed', failure: 'partial' });
});
it.each(['short', 'surplus', 'empty'] as const)(
  'synthetic service holds %s input even when a scanner attempts to consume it',
  async (kind) => {
    const client = createScannerServiceClient(
      transport(createNodeAttachmentScannerService(serviceScanner, secret)),
      createNodeBlobDigest,
      secret,
    );
    const stream =
      kind === 'empty'
        ? new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(new Uint8Array());
              c.close();
            },
          })
        : body();
    expect(
      (
        await scan(client, {
          body: stream,
          sizeBytes: kind === 'short' ? 4 : kind === 'surplus' ? 2 : 3,
        })
      ).status,
    ).toBe('failed');
  },
);
it('synthetic timeout cancels input and a late response without accepting a late clean result', async () => {
  let finish!: (
    value: Awaited<ReturnType<ScannerServiceTransport['send']>>,
  ) => void;
  let signal!: AbortSignal,
    canceled = false;
  const client = createScannerServiceClient(
    {
      send(input) {
        signal = input.signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
    createNodeBlobDigest,
    secret,
    20,
  );
  expect(await scan(client)).toEqual({ status: 'failed', failure: 'timeout' });
  expect(signal.aborted).toBe(true);
  finish({
    status: 200,
    contentType: 'application/json',
    body: new ReadableStream({
      cancel() {
        canceled = true;
      },
    }),
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(canceled).toBe(true);
});
it('synthetic service failure and invalid outcome expose only a fixed failed envelope', async () => {
  for (const mode of ['throw', 'invalid', 'no-read']) {
    const handler = createNodeAttachmentScannerService(
      {
        async scan() {
          if (mode === 'throw') throw new Error('private-scanner-error');
          if (mode === 'invalid')
            return {
              status: 'clean',
              evidence: {
                engine: 'x',
                engineVersion: '',
                signatureVersion: 'x',
              },
            };
          return syntheticClean;
        },
      },
      secret,
    );
    const client = createScannerServiceClient(
      transport(handler),
      createNodeBlobDigest,
      secret,
    );
    const outcome = await scan(client);
    expect(outcome.status).toBe('failed');
    expect(JSON.stringify(outcome)).not.toContain('private');
  }
});
