import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowed = {
  contracts: [],
  domain: [],
  security: [],
  config: [],
  observability: [],
  testing: ['contracts', 'domain', 'application'],
  application: ['domain', 'contracts'],
  server: [
    'application',
    'domain',
    'contracts',
    'security',
    'config',
    'observability',
  ],
  'database-d1': ['domain', 'application'],
  'database-postgres': ['domain', 'application'],
};
const pure = new Set([
  'domain',
  'application',
  'contracts',
  'security',
  'config',
  'observability',
]);
const externalAllowed = {
  contracts: ['@sinclair/typebox'],
  domain: [],
  application: [],
  security: [],
  config: [],
  observability: [],
};

function owner(file) {
  const parts = relative(root, file).split(sep);
  if (parts[0] === 'apps') return parts[1];
  if (parts[0] !== 'packages') return undefined;
  return parts[1] === 'database' ? `database-${parts[2]}` : parts[1];
}
export function checkImport(file, specifier) {
  const from = owner(resolve(root, file));
  if (!from) return undefined;
  const target = specifier.startsWith('.')
    ? owner(resolve(dirname(resolve(root, file)), specifier))
    : specifier.startsWith('@hyperbug/')
      ? specifier.slice(10).split('/')[0]
      : undefined;
  if (
    target &&
    target !== from &&
    allowed[from] &&
    !allowed[from].includes(target)
  )
    return `${file}: forbidden dependency ${from} -> ${target}`;
  if (specifier.startsWith('.') && target && target !== from)
    return `${file}: cross-package relative import; use package exports`;
  if (
    !specifier.startsWith('.') &&
    !target &&
    pure.has(from) &&
    !(externalAllowed[from] ?? []).some(
      (item) => specifier === item || specifier.startsWith(`${item}/`),
    )
  )
    return `${file}: infrastructure import ${specifier} in ${from}`;
  if (
    (from === 'web' || from === 'api-client') &&
    target &&
    !['contracts', 'api-client'].includes(target)
  )
    return `${file}: client imports server implementation ${target}`;
  return undefined;
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    ['node_modules', 'dist', 'migrations'].includes(entry.name)
      ? []
      : entry.isDirectory()
        ? walk(resolve(dir, entry.name))
        : [resolve(dir, entry.name)],
  );
}
export function checkBoundaries() {
  const failures = [];
  for (const file of ['apps', 'packages'].flatMap((directory) =>
    walk(resolve(root, directory)),
  )) {
    const source = readFileSync(file, 'utf8');
    if (file.endsWith('package.json')) {
      const manifest = JSON.parse(source);
      for (const specifier of Object.keys({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
      })) {
        const failure = checkImport(file, specifier);
        if (failure) failures.push(failure);
      }
    } else if (/\.[cm]?[jt]s$/.test(file) && !file.endsWith('.d.ts')) {
      // Cover static imports/exports, side-effect imports, import() type expressions and require().
      for (const match of source.matchAll(
        /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]([^'"]+)['"]/g,
      )) {
        const failure = checkImport(file, match[1]);
        if (failure) failures.push(failure);
      }
    }
  }
  return failures;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const failures = checkBoundaries();
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log('Workspace import boundaries passed.');
}
