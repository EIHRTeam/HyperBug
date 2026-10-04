/* eslint-disable no-await-in-loop -- Fixed three-database verification and one physical child per scanner. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath, readdir, mkdtemp, rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import {
  assertBlobSize,
  assertBlobType,
  type AttachmentScanner,
  type ScanEvidence,
  type ScanOutcome,
} from '@hyperbug/application';
import { nodeSecretFileSource } from './key-provider.ts';
import { startScannerProcess } from './scanner-process.ts';

export interface ClamAVScannerConfig {
  executable: string;
  executableSha256: string;
  sigtool: string;
  sigtoolSha256: string;
  certificateDirectory: string;
  certificateSha256: string;
  databaseDirectory: string;
  temporaryDirectory: string;
  /** Required snapshot freshness; at most 48 hours for the official daily database. */
  maxSignatureAgeMs: number;
}
interface Asset {
  path: string;
  stamp: string;
}
const failed = (
  failure: Extract<ScanOutcome, { status: 'failed' }>['failure'],
): ScanOutcome => ({ status: 'failed', failure });
const fingerprint = (value: Awaited<ReturnType<typeof lstat>>) =>
  [
    value.dev,
    value.ino,
    value.size,
    value.mtimeMs,
    value.ctimeMs,
    value.mode,
    value.uid,
  ].join(':');

/** Explicit trusted local engine. Updates require a new immutable snapshot and scanner instance. */
export async function createClamAVAttachmentScanner(
  supplied: ClamAVScannerConfig,
): Promise<
  AttachmentScanner & {
    evidence: Readonly<ScanEvidence>;
    close(): Promise<void>;
  }
> {
  const controller = new AbortController();
  let startupTimer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    startupTimer = setTimeout(() => {
      controller.abort();
      reject(new Error('Invalid attachment scanner configuration'));
    }, 30000);
  });
  let ready = false;
  const initialize = async () => {
    try {
      const config = { ...supplied };
      if (
        !['darwin', 'linux'].includes(process.platform) ||
        Object.keys(config).sort().join(',') !==
          'certificateDirectory,certificateSha256,databaseDirectory,executable,executableSha256,maxSignatureAgeMs,sigtool,sigtoolSha256,temporaryDirectory' ||
        !Number.isSafeInteger(config.maxSignatureAgeMs) ||
        config.maxSignatureAgeMs < 1 ||
        config.maxSignatureAgeMs > 48 * 3600000 ||
        ![
          config.executableSha256,
          config.sigtoolSha256,
          config.certificateSha256,
        ].every((s) => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s))
      )
        throw new Error();
      const assets: Asset[] = [];
      const trusted = async (
        path: string,
        kind: 'directory' | 'file',
        readOnly = false,
        maxBytes = 64 * 1024 ** 2,
      ) => {
        controller.signal.throwIfAborted();
        if (
          typeof path !== 'string' ||
          !isAbsolute(path) ||
          path.length > 4096 ||
          /[\p{Cc}\p{Cs}]/u.test(path)
        )
          throw new Error();
        const canonical = await realpath(path);
        if (readOnly && (await lstat(path)).isSymbolicLink()) throw new Error();
        const stat = await lstat(canonical);
        if (
          (kind === 'directory' ? !stat.isDirectory() : !stat.isFile()) ||
          ![0, process.getuid!()].includes(stat.uid) ||
          (stat.mode & 0o022) !== 0 ||
          (readOnly && (stat.mode & 0o222) !== 0) ||
          (kind === 'file' && (stat.size < 1 || stat.size > maxBytes))
        )
          throw new Error();
        controller.signal.throwIfAborted();
        assets.push({ path: canonical, stamp: fingerprint(stat) });
        return canonical;
      };
      const hash = async (path: string) => {
        const digest = createHash('sha256');
        for await (const chunk of createReadStream(path, {
          highWaterMark: 65536,
          signal: controller.signal,
        }))
          digest.update(chunk);
        controller.signal.throwIfAborted();
        return digest.digest('hex');
      };
      const executable = await trusted(config.executable, 'file');
      const sigtool = await trusted(config.sigtool, 'file');
      const databaseDirectory = await trusted(
        config.databaseDirectory,
        'directory',
        true,
      );
      const certificateDirectory = await trusted(
        config.certificateDirectory,
        'directory',
        true,
      );
      const temporaryDirectory = await trusted(
        config.temporaryDirectory,
        'directory',
      );
      const temporaryStat = await lstat(temporaryDirectory);
      if (
        temporaryStat.uid !== process.getuid!() ||
        (temporaryStat.mode & 0o077) !== 0
      )
        throw new Error();
      // Temp content may change during scans; only the immutable engine/snapshot assets are fenced.
      assets.pop();
      const temporaryIdentity = (stat: typeof temporaryStat) =>
        [stat.dev, stat.ino, stat.mode, stat.uid].join(':');
      const certificate = await trusted(
        join(certificateDirectory, 'clamav.crt'),
        'file',
        true,
        16384,
      );
      if (
        (await readdir(certificateDirectory)).sort().join(',') !==
          'clamav.crt' ||
        (await hash(executable)) !== config.executableSha256 ||
        (await hash(sigtool)) !== config.sigtoolSha256 ||
        (await hash(certificate)) !== config.certificateSha256
      )
        throw new Error();
      const command = async (program: string, args: string[]) => {
        controller.signal.throwIfAborted();
        const run = startScannerProcess({
          executable: program,
          args,
          certificateDirectory,
          signal: controller.signal,
          timeoutMs: 15000,
        });
        const result = await run.result;
        try {
          if (result.failure || result.code !== 0 || result.stderr.trim())
            throw new Error();
        } finally {
          await run.closed;
        }
        controller.signal.throwIfAborted();
        return result.stdout;
      };
      const names: string[] = [],
        versions: string[] = [];
      let dailyAt = 0,
        dailyVersion = '';
      let totalDatabaseBytes = 0;
      for (const name of ['daily', 'main', 'bytecode']) {
        const file = await trusted(
          join(databaseDirectory, `${name}.cvd`),
          'file',
          true,
          128 * 1024 ** 2,
        );
        totalDatabaseBytes += (await lstat(file)).size;
        if (totalDatabaseBytes > 256 * 1024 ** 2) throw new Error();
        const info = await command(sigtool, [
          '--cvdcertsdir',
          certificateDirectory,
          '--info',
          file,
        ]);
        const version = /^Version: ([1-9][0-9]{0,8})$/m.exec(info)?.[1];
        const signatures = /^Signatures: ([1-9][0-9]{0,8})$/m.exec(info)?.[1];
        const built =
          /^Build time: ([0-9]{2} [A-Z][a-z]{2} [0-9]{4} [0-9]{2}:[0-9]{2} [+-][0-9]{4})$/m.exec(
            info,
          )?.[1];
        if (
          !version ||
          !signatures ||
          !built ||
          !info.includes('\nVerification OK.')
        )
          throw new Error();
        const signName = `${name}-${version}.cvd.sign`;
        await trusted(join(databaseDirectory, signName), 'file', true, 65536);
        const verification = await command(sigtool, [
          '--cvdcertsdir',
          certificateDirectory,
          '--verify',
          file,
        ]);
        if (
          !verification.includes('Successfully verified file') ||
          !verification.includes("signed by 'ClamAV_datafiles_release'")
        )
          throw new Error();
        names.push(`${name}.cvd`, signName);
        versions.push(`${name}:${version}`);
        if (name === 'daily') {
          dailyAt = Date.parse(built);
          dailyVersion = version;
        }
      }
      const fresh = () => {
        const age = Date.now() - dailyAt;
        if (
          !Number.isFinite(dailyAt) ||
          dailyAt <= 0 ||
          age < -300000 ||
          age > config.maxSignatureAgeMs
        )
          throw new Error();
      };
      const checkAssets = async (signal: AbortSignal) => {
        signal.throwIfAborted();
        fresh();
        if (
          (await readdir(databaseDirectory)).sort().join(',') !==
          [...names].sort().join(',')
        )
          throw new Error();
        if (
          (await readdir(certificateDirectory)).sort().join(',') !==
          'clamav.crt'
        )
          throw new Error();
        for (const asset of assets) {
          signal.throwIfAborted();
          const stat = await lstat(asset.path);
          if (stat.isSymbolicLink() || fingerprint(stat) !== asset.stamp)
            throw new Error();
        }
        signal.throwIfAborted();
        fresh();
      };
      await checkAssets(controller.signal);
      const versionOutput = await command(executable, [
        `--database=${databaseDirectory}`,
        `--cvdcertsdir=${certificateDirectory}`,
        '--version',
      ]);
      const engineVersion = new RegExp(
        `^ClamAV ([0-9]+\\.[0-9]+\\.[0-9]+)/${dailyVersion}/[^\\r\\n]+\\n?$`,
      ).exec(versionOutput)?.[1];
      if (!engineVersion || engineVersion.length > 32) throw new Error();
      await checkAssets(controller.signal);
      const evidence = Object.freeze({
        engine: 'ClamAV',
        engineVersion,
        signatureVersion: versions.join(','),
      });
      let active = false,
        closed = false;
      let current: AbortController | undefined;
      let pending: Promise<void> | undefined;
      ready = true;
      return {
        evidence,
        async close() {
          closed = true;
          current?.abort();
          await pending;
        },
        async scan(input: Parameters<AttachmentScanner['scan']>[0]) {
          if (closed || active) return failed('unavailable');
          const signal = new AbortController();
          const abort = () => signal.abort();
          input.signal.addEventListener('abort', abort, { once: true });
          if (input.signal.aborted) abort();
          current = signal;
          active = true;
          let directory: string | undefined;
          let run: ReturnType<typeof startScannerProcess> | undefined;
          let timeout: ReturnType<typeof setTimeout> | undefined;
          let cleanupFailed = false;
          const denied = new Promise<ScanOutcome>((resolve) => {
            signal.signal.addEventListener(
              'abort',
              () => {
                run?.stop();
                resolve(failed('timeout'));
              },
              { once: true },
            );
            timeout = setTimeout(abort, 60000);
            if (signal.signal.aborted) resolve(failed('timeout'));
          });
          const work = (async (): Promise<ScanOutcome> => {
            try {
              assertBlobSize(input.sizeBytes);
              assertBlobType(input.contentType);
              if (input.sizeBytes > 32 * 1024 ** 2) return failed('partial');
              await checkAssets(signal.signal);
              const temp = await lstat(temporaryDirectory);
              if (
                temp.isSymbolicLink() ||
                temporaryIdentity(temp) !== temporaryIdentity(temporaryStat)
              )
                return failed('unavailable');
              signal.signal.throwIfAborted();
              directory = await mkdtemp(join(temporaryDirectory, 'scan-'));
              signal.signal.throwIfAborted();
              run = startScannerProcess({
                executable,
                certificateDirectory,
                signal: signal.signal,
                timeoutMs: 60000,
                body: input.body,
                sizeBytes: input.sizeBytes,
                args: [
                  `--database=${databaseDirectory}`,
                  `--cvdcertsdir=${certificateDirectory}`,
                  `--tempdir=${directory}`,
                  // ClamAV's ZIP extractor can trim a member without a size alert.
                  // Match the aggregate cap so trimmed output exceeds the remaining
                  // scan budget once its nonempty container has been counted.
                  '--max-filesize=128M',
                  '--max-scansize=128M',
                  '--max-files=100',
                  '--max-recursion=8',
                  '--max-dir-recursion=8',
                  '--max-scantime=10000',
                  '--pcre-match-limit=100000',
                  '--pcre-recmatch-limit=2000',
                  '--pcre-max-filesize=128M',
                  '--alert-exceeds-max=yes',
                  '--alert-encrypted=yes',
                  '--alert-broken=yes',
                  '--disable-cache',
                  '--no-summary',
                  '--stdout',
                  '-',
                ],
              });
              const result = await run.result;
              if (result.failure) return failed(result.failure);
              if (!result.complete) return failed('partial');
              await checkAssets(signal.signal);
              if (result.stderr.trim()) return failed('unavailable');
              if (result.code === 0 && result.stdout === 'stdin: OK\n')
                return { status: 'clean', evidence };
              if (
                result.code === 1 &&
                /^stdin: [A-Za-z0-9._:-]{1,256} FOUND\n$/.test(result.stdout)
              ) {
                if (
                  /Heuristics\.(?:Limits|Encrypted|Broken)/.test(result.stdout)
                )
                  return failed('partial');
                return { status: 'infected', evidence };
              }
              return failed(
                result.code === 2 ? 'unavailable' : 'invalid-result',
              );
            } catch {
              return failed(signal.signal.aborted ? 'timeout' : 'unavailable');
            } finally {
              // A timeout returns promptly, but the slot stays held until the actual process is reaped.
              if (run) await run.closed;
              if (directory)
                await rm(directory, { recursive: true, force: true }).catch(
                  () => {
                    cleanupFailed = true;
                    closed = true;
                  },
                );
              active = false;
              current = undefined;
            }
          })();
          pending = work.then(
            () => {},
            () => {},
          );
          try {
            const outcome = await Promise.race([work, denied]);
            return cleanupFailed ? failed('unavailable') : outcome;
          } finally {
            if (timeout !== undefined) clearTimeout(timeout);
            input.signal.removeEventListener('abort', abort);
            if (signal.signal.aborted) run?.stop();
          }
        },
      };
    } catch {
      throw new Error('Invalid attachment scanner configuration');
    }
  };
  try {
    return await Promise.race([initialize(), deadline]);
  } finally {
    clearTimeout(startupTimer!);
    if (!ready) controller.abort();
  }
}

export async function configureNodeAttachmentScanner(file: string | undefined) {
  if (file === undefined) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Invalid attachment scanner configuration'));
    }, 5000);
  });
  try {
    const value = JSON.parse(
      await Promise.race([
        nodeSecretFileSource(file).read(controller.signal),
        timeout,
      ]),
    ) as ClamAVScannerConfig;
    controller.signal.throwIfAborted();
    clearTimeout(timer!);
    return await createClamAVAttachmentScanner(value);
  } catch {
    throw new Error('Invalid attachment scanner configuration');
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
