import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { createPostgresKeyRegistry } from '@hyperbug/database-postgres';
import {
  registryMutation,
  type KeyReference,
  type KeyRegistry,
} from '../packages/security/src/index.ts';

/** Trusted operator channel only. Uses existing audited registry policy. */
export async function activateOperatorKeys(
  registry: KeyRegistry,
  references: readonly KeyReference[],
) {
  if (references.length < 1 || references.length > 4)
    throw new Error('Invalid operator references');
  const changes = references.map(
    (key) =>
      registryMutation({
        expectedGeneration: 1,
        auditId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        now: Date.now(),
        change: { kind: 'activate', key },
      }).change,
  );
  if (new Set(references.map((key) => key.purpose)).size !== references.length)
    throw new Error('Duplicate operator purpose');
  for (const change of changes) {
    const snapshot = await registry.inspect(AbortSignal.timeout(5000));
    if (
      change.kind !== 'activate' ||
      snapshot.keys.some((entry) => entry.ref.purpose === change.key.purpose)
    )
      throw new Error(
        'Purpose already initialized; inspect and use a reviewed rotation',
      );
    await registry.mutate({
      expectedGeneration: snapshot.generation,
      auditId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      now: Date.now(),
      change,
    });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const file = process.argv[2];
  const connectionString = process.env.HYPERBUG_MIGRATION_DATABASE_URL;
  if (
    process.argv.length !== 3 ||
    !file ||
    !isAbsolute(file) ||
    !connectionString
  )
    throw new Error(
      'Set explicit HYPERBUG_MIGRATION_DATABASE_URL and pass an absolute public-reference file',
    );
  const endpoint = new URL(connectionString);
  if (
    !['postgres:', 'postgresql:'].includes(endpoint.protocol) ||
    endpoint.search ||
    endpoint.hash ||
    !endpoint.hostname
  )
    throw new Error(
      'Operator connection requires a PostgreSQL TCP URI without query/fragment; verified TLS is mandatory',
    );
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
  });
  pool.on('error', () => {});
  try {
    await activateOperatorKeys(
      createPostgresKeyRegistry(pool),
      JSON.parse(await readFile(file, 'utf8')),
    );
    console.log('Operator key references activated through audited registry');
  } finally {
    await pool.end();
  }
}
