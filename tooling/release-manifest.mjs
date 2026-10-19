import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Local unsigned build metadata only. No secrets, network or publication.
const sha = (value) => createHash('sha256').update(value).digest('hex');
const output = process.argv[2];
if (process.argv.length !== 3 || !output)
  throw new Error('Pass the output JSON path');
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error('Artifact symlinks are refused');
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}
const roots = [
  'dist/node',
  'dist/cloudflare',
  'dist/cloudflare-minimum',
  'dist/cloudflare-ingress',
  'apps/web/dist',
  'docs/.vitepress/dist',
];
const artifacts = [];
for (const root of roots)
  for (const path of await files(root)) {
    const bytes = await readFile(path);
    artifacts.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
const inputs = execFileSync(
  'git',
  [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    'apps',
    'packages',
    'tooling',
    'tests',
    'docs/site',
    'docs/.vitepress/config.ts',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'vitest.config.ts',
  ],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean)
  .sort();
const sourceInputs = [];
for (const path of inputs)
  sourceInputs.push({ path, sha256: sha(await readFile(path)) });
const manifest = {
  v: 1,
  recordedAt: new Date().toISOString(),
  status: 'prepared-but-unpublished',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  sourceRevisionRole:
    'base commit; exact working-tree inputs are identified by sourceInputsSha256',
  sourceInputsSha256: sha(JSON.stringify(sourceInputs)),
  lockfileSha256: sha(await readFile('pnpm-lock.yaml')),
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    openssl: process.versions.openssl,
    pnpm: execFileSync('corepack', ['pnpm', '--version'], {
      encoding: 'utf8',
    }).trim(),
  },
  commands: [
    'corepack pnpm install --frozen-lockfile',
    'corepack pnpm build',
    'corepack pnpm docs:build',
    'node tooling/release-manifest.mjs <output.json>',
  ],
  provenance:
    'unsigned local source/lock/runtime/hash metadata; no trusted signing identity or hosted attestation run',
  sourceMaps:
    'backend maps are private diagnostic artifacts; never publish them on a public static host',
  artifacts,
  sourceInputs,
};
await writeFile(output, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `Wrote ${artifacts.length} artifact hashes and ${sourceInputs.length} source input hashes`,
);
