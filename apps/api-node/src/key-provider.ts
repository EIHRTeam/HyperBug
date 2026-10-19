import { constants } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import {
  CryptoFailure,
  SecretKeyProvider,
  type KeyLifecycle,
  type SecretKeySource,
} from '@hyperbug/security';

/** A private POSIX secret mount; runtime policy/env contains the path, not the key. */
export function nodeSecretFileSource(path: string): SecretKeySource {
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    typeof process.getuid !== 'function'
  )
    throw new CryptoFailure();
  return {
    async read(signal) {
      let file: FileHandle | undefined;
      const bytes = new Uint8Array(16385);
      try {
        if (signal.aborted) throw new CryptoFailure();
        file = await open(
          path,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const stat = await file.stat();
        if (
          signal.aborted ||
          !stat.isFile() ||
          stat.uid !== process.getuid!() ||
          ![0o400, 0o600].includes(stat.mode & 0o7777) ||
          stat.size < 1 ||
          stat.size > 16384
        )
          throw new CryptoFailure();
        let length = 0;
        while (length < bytes.length) {
          // A bounded file descriptor must be read serially; never trust stat against growth.
          // eslint-disable-next-line no-await-in-loop
          const { bytesRead } = await file.read(
            bytes,
            length,
            bytes.length - length,
            length,
          );
          if (signal.aborted) throw new CryptoFailure();
          if (bytesRead === 0) break;
          length += bytesRead;
        }
        const after = await file.stat();
        if (
          signal.aborted ||
          length < 1 ||
          length > 16384 ||
          length !== stat.size ||
          after.size !== stat.size ||
          after.mtimeMs !== stat.mtimeMs ||
          after.ctimeMs !== stat.ctimeMs
        )
          throw new CryptoFailure();
        return new TextDecoder('utf-8', { fatal: true }).decode(
          bytes.subarray(0, length),
        );
      } catch {
        throw new CryptoFailure();
      } finally {
        bytes.fill(0);
        await file?.close().catch(() => {});
      }
    },
  };
}

export function createNodeKeyProvider(
  path: string,
  lifecycle: KeyLifecycle,
  timeoutMs = 1000,
): SecretKeyProvider {
  return new SecretKeyProvider(
    nodeSecretFileSource(path),
    lifecycle,
    timeoutMs,
  );
}
