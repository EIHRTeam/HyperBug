import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

// Offline operator provisioning only. Never prints material or contacts a service.
const target = process.argv[2];
if (process.argv.length !== 3 || !target || !isAbsolute(target))
  throw new Error('Pass a new absolute private directory');
await mkdir(target, { mode: 0o700 }); // Existing directories are deliberately refused.
try {
  const purposes = [
    'token-hmac',
    'blind-index',
    'envelope-kek',
    'password-pepper',
  ];
  const keys = purposes.map((purpose) => ({
    ref: { purpose, id: 'operator-v1', version: 1 },
    material: randomBytes(32).toString('base64url'),
  }));
  const files = {
    'keys.json': JSON.stringify({ v: 1, keys }),
    'abuse.json': JSON.stringify({
      v: 1,
      current: 1,
      keys: [{ version: 1, material: randomBytes(32).toString('base64url') }],
    }),
    'bootstrap.txt': 'hbbs1_' + randomBytes(32).toString('base64url'),
    'ingress.txt': randomBytes(32).toString('base64url'),
  };
  for (const [name, value] of Object.entries(files))
    await writeFile(join(target, name), value + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
  await writeFile(
    join(target, 'key-references.json'),
    JSON.stringify(
      keys.map((key) => key.ref),
      null,
      2,
    ) + '\n',
    { mode: 0o600, flag: 'wx' },
  );
  console.log(
    'Created private operator files; activate key references through the audited KeyRegistry before enabling accounts.',
  );
} catch (error) {
  await rm(target, { recursive: true, force: true });
  throw error;
}
