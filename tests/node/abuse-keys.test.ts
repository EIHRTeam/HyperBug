import { it, expect } from 'vitest';
import { mkdtemp, writeFile, chmod, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeAbuseKeyProvider } from '../../apps/api-node/src/abuse-keys.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';

it('loads rotating abuse keys only from a private regular file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hyperbug-abuse-key-'));
  const path = join(directory, 'abuse.json');
  const signal = new AbortController().signal;
  try {
    await writeFile(path, abuseKeyFixture(), { mode: 0o600 });
    expect(
      (await createNodeAbuseKeyProvider(path).active(signal)).map(
        (entry) => entry.version,
      ),
    ).toEqual([2, 1]);
    await chmod(path, 0o644);
    await expect(
      createNodeAbuseKeyProvider(path).active(signal),
    ).rejects.toThrow();
    await chmod(path, 0o600);
    const link = join(directory, 'link.json');
    await symlink(path, link);
    await expect(
      createNodeAbuseKeyProvider(link).active(signal),
    ).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
