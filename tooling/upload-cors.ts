import { readFile } from 'node:fs/promises';
import {
  createUploadCorsRules,
  validateUploadCorsRules,
} from '@hyperbug/application';

try {
  const [mode, format, originsFile, snapshotFile, ...extra] =
    process.argv.slice(2);
  if (
    !['prepare', 'check'].includes(mode ?? '') ||
    !['r2', 's3'].includes(format ?? '') ||
    !originsFile ||
    extra.length ||
    (mode === 'prepare' ? snapshotFile !== undefined : !snapshotFile)
  )
    throw new Error();
  const read = async (path: string) => {
    const data = await readFile(path, 'utf8');
    if (data.length > 65536) throw new Error();
    return JSON.parse(data) as unknown;
  };
  const origins = (await read(originsFile)) as string[];
  if (mode === 'prepare') {
    const rules = createUploadCorsRules(origins);
    process.stdout.write(
      JSON.stringify(format === 's3' ? { CORSRules: rules } : rules, null, 2) +
        '\n',
    );
  } else {
    const snapshot = await read(snapshotFile!);
    validateUploadCorsRules(
      format === 's3' &&
        snapshot &&
        typeof snapshot === 'object' &&
        'CORSRules' in snapshot
        ? snapshot.CORSRules
        : snapshot,
      origins,
    );
    process.stdout.write(
      'Exact upload CORS snapshot accepted; remote state and browser behavior remain unverified.\n',
    );
  }
} catch {
  process.stderr.write(
    'Invalid upload CORS input. Usage: node tooling/upload-cors.ts prepare|check r2|s3 origins.json [snapshot.json]\n',
  );
  process.exitCode = 1;
}
