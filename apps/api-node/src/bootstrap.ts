import { isAbsolute } from 'node:path';
import { parseBootstrapEnrollmentCode } from '@hyperbug/server';
import { nodeSecretFileSource } from './key-provider.ts';

/**
 * Reads the operator-channel enrollment code from a private mount with the
 * same ownership/mode/no-follow rules as the key rings. Absent disarms the
 * bootstrap route; a present but malformed file refuses startup.
 */
export async function loadNodeBootstrapEnrollmentCode(
  path: unknown,
): Promise<string | null> {
  if (path === undefined) return null;
  if (
    typeof path !== 'string' ||
    !isAbsolute(path) ||
    path.includes('\0') ||
    path.length > 4096
  )
    throw new Error('Invalid bootstrap enrollment configuration');
  const content = await nodeSecretFileSource(path).read(
    AbortSignal.timeout(2000),
  );
  const code = parseBootstrapEnrollmentCode(content.trim());
  if (code === null)
    throw new Error('Invalid bootstrap enrollment configuration');
  return code;
}
