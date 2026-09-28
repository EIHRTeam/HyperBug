import { it, expect } from 'vitest';
import {
  mkdtemp,
  writeFile,
  chmod,
  symlink,
  rm,
  rename,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createNodeKeyProvider,
  nodeSecretFileSource,
} from '../../apps/api-node/src/key-provider.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';

it('reads fresh private secret files and rejects unsafe mounts without exposing filesystem details', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hyperbug-key-source-'));
  const path = join(directory, 'keys.json');
  const { source, lifecycle } = cryptoFixture();
  const provider = createNodeKeyProvider(path, lifecycle);
  const safeFailure = {
    code: 'CRYPTO_FAILURE',
    message: 'Cryptographic operation failed.',
  };
  try {
    await expect(provider.current('envelope-kek')).rejects.toMatchObject(
      safeFailure,
    );
    await writeFile(path, await source.read(), { mode: 0o600 });
    expect((await provider.current('envelope-kek')).key.extractable).toBe(
      false,
    );
    await chmod(path, 0o644);
    await expect(provider.current('envelope-kek')).rejects.toMatchObject(
      safeFailure,
    );
    await chmod(path, 0o400);
    expect((await provider.current('token-hmac')).ref.purpose).toBe(
      'token-hmac',
    );
    const link = join(directory, 'link.json');
    await symlink(path, link);
    await expect(
      createNodeKeyProvider(link, lifecycle).current('token-hmac'),
    ).rejects.toMatchObject(safeFailure);
    const replacement = join(directory, 'replacement.json');
    await writeFile(replacement, '{invalid', { mode: 0o600 });
    await rename(replacement, path);
    await expect(provider.current('token-hmac')).rejects.toMatchObject(
      safeFailure,
    );
    await writeFile(path, 'x'.repeat(16385));
    await expect(provider.current('token-hmac')).rejects.toMatchObject(
      safeFailure,
    );
    const signal = new AbortController();
    signal.abort();
    await expect(
      nodeSecretFileSource(path).read(signal.signal),
    ).rejects.toMatchObject(safeFailure);
    await expect(
      createNodeKeyProvider(directory, lifecycle).current('token-hmac'),
    ).rejects.toMatchObject(safeFailure);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
