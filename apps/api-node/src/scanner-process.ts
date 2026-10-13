/* eslint-disable no-await-in-loop -- One bounded producer chunk and one child stdin write at a time. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ScanFailure } from '@hyperbug/application';

export interface ScannerProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  complete: boolean;
  failure: ScanFailure | null;
}

/** Trusted executable/arguments only. No shell, inherited environment, queue or unbounded output. */
export function startScannerProcess(input: {
  executable: string;
  args: readonly string[];
  certificateDirectory: string;
  signal: AbortSignal;
  timeoutMs: number;
  body?: ReadableStream<Uint8Array>;
  sizeBytes?: number;
}) {
  if (input.signal.aborted)
    return {
      pid: undefined,
      result: Promise.resolve<ScannerProcessResult>({
        code: null,
        stdout: '',
        stderr: '',
        complete: false,
        failure: 'timeout',
      }),
      closed: Promise.resolve(),
      stop() {},
    };
  let child: ChildProcessWithoutNullStreams;
  try {
    if (
      !Number.isInteger(input.timeoutMs) ||
      input.timeoutMs < 1 ||
      input.timeoutMs > 60000 ||
      (input.body &&
        (!Number.isSafeInteger(input.sizeBytes) ||
          input.sizeBytes! < 0 ||
          input.sizeBytes! > 32 * 1024 ** 2))
    )
      throw new Error();
    child = spawn(input.executable, [...input.args], {
      shell: false,
      detached: true,
      stdio: 'pipe',
      env: {
        LC_ALL: 'C',
        LANG: 'C',
        CVD_CERTS_DIR: input.certificateDirectory,
      },
    });
  } catch {
    return {
      pid: undefined,
      result: Promise.resolve<ScannerProcessResult>({
        code: null,
        stdout: '',
        stderr: '',
        complete: false,
        failure: 'unavailable',
      }),
      closed: Promise.resolve(),
      stop() {},
    };
  }
  let closed = false,
    settled = false,
    complete = input.body === undefined;
  let stdout = '',
    stderr = '',
    outputBytes = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let forceKill: ReturnType<typeof setTimeout> | undefined;
  let resolveResult!: (value: ScannerProcessResult) => void;
  let resolveClosed!: () => void;
  const result = new Promise<ScannerProcessResult>((resolve) => {
    resolveResult = resolve;
  });
  const reaped = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const finish = (code: number | null, failure: ScanFailure | null) => {
    if (settled) return;
    settled = true;
    resolveResult({ code, stdout, stderr, complete, failure });
  };
  const killGroup = (signal: 'SIGTERM' | 'SIGKILL') => {
    if (closed || child.pid === undefined) return;
    try {
      process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        /* Fixed failure already retained. */
      }
    }
  };
  const stop = (failure: ScanFailure = 'timeout') => {
    if (closed || settled) return;
    finish(null, failure);
    void reader?.cancel().catch(() => {});
    child.stdin.destroy();
    killGroup('SIGTERM');
    forceKill = setTimeout(() => killGroup('SIGKILL'), 300);
  };
  const aborted = () => stop('timeout');
  const timeout = setTimeout(aborted, input.timeoutMs);
  input.signal.addEventListener('abort', aborted, { once: true });
  child.on('error', () => stop('unavailable'));
  child.stdin.on('error', () => stop('partial'));
  const output = (kind: 'stdout' | 'stderr', chunk: Buffer) => {
    if (settled || closed) return;
    outputBytes += chunk.byteLength;
    if (outputBytes > 8192) {
      stop('invalid-result');
      return;
    }
    if (kind === 'stdout') stdout += chunk.toString('utf8');
    else stderr += chunk.toString('utf8');
  };
  child.stdout.on('data', (chunk: Buffer) => output('stdout', chunk));
  child.stderr.on('data', (chunk: Buffer) => output('stderr', chunk));
  child.on('close', (code) => {
    closed = true;
    clearTimeout(timeout);
    if (forceKill !== undefined) clearTimeout(forceKill);
    input.signal.removeEventListener('abort', aborted);
    if (!complete) void reader?.cancel().catch(() => {});
    finish(code, null);
    resolveClosed();
  });
  if (input.signal.aborted) aborted();
  else if (!input.body) child.stdin.end();
  else {
    try {
      reader = input.body.getReader();
    } catch {
      stop('partial');
      return { pid: child.pid, result, closed: reaped, stop };
    }
    const source = reader;
    void (async () => {
      let received = 0;
      try {
        for (;;) {
          if (closed || settled || input.signal.aborted) return;
          const next = await source.read();
          if (closed || settled || input.signal.aborted) return;
          if (next.done) {
            if (received !== input.sizeBytes) {
              stop('partial');
              return;
            }
            complete = true;
            child.stdin.end();
            return;
          }
          if (
            !(next.value instanceof Uint8Array) ||
            next.value.byteLength === 0 ||
            next.value.byteLength > input.sizeBytes! - received
          ) {
            stop('partial');
            return;
          }
          received += next.value.byteLength;
          await new Promise<void>((resolve, reject) =>
            child.stdin.write(next.value, (error) =>
              error ? reject(error) : resolve(),
            ),
          );
        }
      } catch {
        stop('partial');
      } finally {
        try {
          source.releaseLock();
        } catch {
          /* A canceled outstanding read releases later. */
        }
      }
    })();
  }
  return { pid: child.pid, result, closed: reaped, stop };
}
