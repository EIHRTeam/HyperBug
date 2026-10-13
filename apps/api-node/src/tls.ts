import { createSecureContext } from 'node:tls';
import { nodeSecretFileSource } from './key-provider.ts';

export interface NodeTls {
  cert: string;
  key: string;
}

/** Optional private PEM mount, bounded by the existing secret-file reader. */
export async function loadNodeTls(
  file: string | undefined,
): Promise<NodeTls | undefined> {
  if (file === undefined) return undefined;
  try {
    const value = JSON.parse(
      await nodeSecretFileSource(file).read(AbortSignal.timeout(2000)),
    ) as NodeTls;
    if (
      !value ||
      Object.keys(value).sort().join(',') !== 'cert,key' ||
      typeof value.cert !== 'string' ||
      typeof value.key !== 'string' ||
      !value.cert.startsWith('-----BEGIN CERTIFICATE-----') ||
      !/^-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(value.key)
    )
      throw new Error();
    createSecureContext({ ...value, minVersion: 'TLSv1.2' });
    return { cert: value.cert, key: value.key };
  } catch {
    throw new Error('Invalid Node TLS configuration');
  }
}
