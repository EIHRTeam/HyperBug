import { afterEach, expect, it } from 'vitest';
import { startScannerProcess } from '../../apps/api-node/src/scanner-process.ts';

const runs: ReturnType<typeof startScannerProcess>[] = [];
afterEach(async () => {
  for (const run of runs.splice(0)) {
    run.stop();
    await run.closed;
  }
});
function launch(
  code: string,
  options: Partial<Parameters<typeof startScannerProcess>[0]> = {},
) {
  const run = startScannerProcess({
    executable: process.execPath,
    args: ['-e', code],
    certificateDirectory: '/private-scanner-certs',
    signal: new AbortController().signal,
    timeoutMs: 2000,
    ...options,
  });
  runs.push(run);
  return run;
}
function body(chunks: number[][]) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(Uint8Array.from(chunk));
      c.close();
    },
  });
}
const echo =
  "let n=0; process.stdin.on('data',c=>n+=c.length); process.stdin.on('end',()=>process.stdout.write(String(n)))";

it('streams exact input through a real child with a private explicit environment', async () => {
  const run = launch(
    echo +
      '; process.stderr.write(JSON.stringify(Object.keys(process.env).sort()))',
    {
      body: body([[1, 2], [3]]),
      sizeBytes: 3,
    },
  );
  const result = await run.result;
  expect(result).toMatchObject({
    code: 0,
    stdout: '3',
    complete: true,
    failure: null,
  });
  // macOS CoreFoundation can synthesize this locale variable even with an explicit env.
  expect(
    (JSON.parse(result.stderr) as string[]).filter(
      (name) =>
        process.platform !== 'darwin' || name !== '__CF_USER_TEXT_ENCODING',
    ),
  ).toEqual(['CVD_CERTS_DIR', 'LANG', 'LC_ALL']);
  await run.closed;
});
it.each(['short', 'surplus', 'empty-chunk', 'reader-error', 'locked'] as const)(
  'rejects %s input without claiming complete consumption',
  async (kind) => {
    const stream =
      kind === 'reader-error'
        ? new ReadableStream<Uint8Array>({
            start(c) {
              c.error(new Error('private-read-error'));
            },
          })
        : body([
            kind === 'empty-chunk' ? [] : kind === 'short' ? [1] : [1, 2, 3, 4],
          ]);
    const lock = kind === 'locked' ? stream.getReader() : undefined;
    try {
      const run = launch(echo, { body: stream, sizeBytes: 3 });
      expect(await run.result).toMatchObject({
        complete: false,
        failure: 'partial',
      });
      await run.closed;
    } finally {
      lock?.releaseLock();
    }
  },
);
it.each(['stdout', 'stderr'] as const)(
  'bounds child %s to 8 KiB combined output',
  async (channel) => {
    const run = launch(
      `process.${channel}.write('x'.repeat(9000)); setInterval(()=>{},1000)`,
    );
    const result = await run.result;
    expect(result.failure).toBe('invalid-result');
    expect(
      Buffer.byteLength(result.stdout + result.stderr),
    ).toBeLessThanOrEqual(8192);
    await run.closed;
  },
);
it('does not mark early child exit as complete input consumption', async () => {
  const run = launch('process.exit(0)', {
    body: new ReadableStream<Uint8Array>(),
    sizeBytes: 3,
  });
  expect(await run.result).toMatchObject({ complete: false });
  await run.closed;
});
it('cancels stalled input and returns before a TERM-resistant child is physically closed', async () => {
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      canceled = true;
    },
  });
  const run = launch(
    "process.on('SIGTERM',()=>{}); process.stdout.write('ready'); setInterval(()=>{},1000)",
    {
      body: stream,
      sizeBytes: 3,
      timeoutMs: 500,
    },
  );
  let reaped = false;
  void run.closed.then(() => {
    reaped = true;
  });
  const result = await run.result;
  expect(result).toMatchObject({
    stdout: 'ready',
    complete: false,
    failure: 'timeout',
  });
  expect(canceled).toBe(true);
  expect(reaped).toBe(false);
  expect(() => process.kill(run.pid!, 0)).not.toThrow();
  await run.closed;
  expect(() => process.kill(run.pid!, 0)).toThrow();
});
it('kills the actual detached process group, including a TERM-resistant descendant', async () => {
  const childCode =
    "process.on('SIGTERM',()=>{}); process.stdout.write('descendant-ready'); setInterval(()=>{},1000)";
  const run = launch(
    `const {spawn}=require('node:child_process'); process.on('SIGTERM',()=>{}); const child=spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:['ignore','pipe','inherit']}); child.stdout.on('data',()=>process.stdout.write(String(child.pid))); setInterval(()=>{},1000)`,
    { timeoutMs: 600 },
  );
  const result = await run.result;
  expect(result.failure).toBe('timeout');
  expect(result.stdout).toMatch(/^[1-9][0-9]+$/);
  await run.closed;
  expect(() => process.kill(run.pid!, 0)).toThrow();
  // The group no longer exists; a just-reparented descendant can briefly remain as an OS zombie.
  expect(() => process.kill(-run.pid!, 0)).toThrow();
});
it('handles asynchronous spawn failure without exposing private process errors', async () => {
  const run = launch('', { executable: '/nonexistent/private-scanner' });
  expect(await run.result).toMatchObject({
    failure: 'unavailable',
    stdout: '',
    stderr: '',
  });
  await run.closed;
});
it('refuses invalid bounds and an already aborted signal before spawning', async () => {
  const aborted = new AbortController();
  aborted.abort();
  for (const options of [
    { signal: aborted.signal },
    { timeoutMs: 0 },
    { body: body([[1]]), sizeBytes: 32 * 1024 ** 2 + 1 },
  ]) {
    const run = launch(echo, options);
    expect(run.pid).toBeUndefined();
    expect((await run.result).failure).toBeTruthy();
    await run.closed;
  }
});
