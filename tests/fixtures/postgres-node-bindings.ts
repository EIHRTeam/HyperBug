import { isAbsolute } from 'node:path';
import type { NodeAbuseBindings } from '../../apps/api-node/src/abuse-admission.ts';

/** Match the isolated socket cluster and the CI loopback service. */
export function postgresNodeBindings(
  databaseName = process.env.PGDATABASE,
): Pick<
  NodeAbuseBindings,
  'databaseUrl' | 'socketDirectory' | 'databaseName' | 'databaseUser'
> {
  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  if (!host || !user || !databaseName)
    throw new Error('Isolated PostgreSQL test cluster is required');
  if (isAbsolute(host))
    return { socketDirectory: host, databaseName, databaseUser: user };
  if (host !== '127.0.0.1' && host !== 'localhost')
    throw new Error('PostgreSQL test host must be local');
  const url = new URL(`postgresql://${host}`);
  url.username = user;
  url.pathname = `/${databaseName}`;
  if (process.env.PGPORT) url.port = process.env.PGPORT;
  return { databaseUrl: url.toString() };
}
