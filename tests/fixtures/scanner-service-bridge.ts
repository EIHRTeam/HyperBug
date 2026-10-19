interface StreamLike {
  getReader(): {
    read(): Promise<{ done: boolean; value?: unknown }>;
    cancel(): Promise<void>;
    releaseLock(): void;
  };
}
/** Explicit streamed Miniflare/Node Web API type bridge; never buffer or cast the file. */
export function scannerServiceNodeRequest(request: {
  url: string;
  method: string;
  headers: Iterable<[string, string]>;
  body: StreamLike | null;
  signal: AbortSignal;
}) {
  const source = request.body?.getReader();
  const body = source
    ? new ReadableStream<Uint8Array>(
        {
          async pull(sink) {
            try {
              const next = await source.read();
              if (next.done) {
                sink.close();
                source.releaseLock();
                return;
              }
              if (!(next.value instanceof Uint8Array)) throw new Error();
              sink.enqueue(next.value);
            } catch {
              void source
                .cancel()
                .catch(() => {})
                .finally(() => source.releaseLock());
              sink.error(new Error('Scanner test bridge input failed'));
            }
          },
          async cancel() {
            try {
              await source.cancel();
            } finally {
              source.releaseLock();
            }
          },
        },
        { highWaterMark: 0 },
      )
    : null;
  const init: RequestInit & { duplex: 'half' } = {
    method: request.method,
    headers: [...request.headers],
    body,
    signal: request.signal,
    duplex: 'half',
  };
  return new Request(request.url, init);
}
