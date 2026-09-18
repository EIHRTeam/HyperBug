import { readFileSync } from 'node:fs';
// pnpm produces an inventory from the installed frozen dependency graph.
const report = JSON.parse(readFileSync(0, 'utf8'));
if (report.error)
  throw new Error('Dependency inventory failed; inspect pnpm output.');
const allowed = new Set([
  'MIT',
  'MIT OR Apache-2.0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'BlueOak-1.0.0',
  'Python-2.0',
  'Unlicense',
  '(MIT OR Apache-2.0)',
  '(Apache-2.0 AND BSD-3-Clause)',
  '(MIT AND ISC)',
  '(MIT AND Zlib)',
]);
const failed = [];
for (const [license, packages] of Object.entries(report)) {
  const reviewedDevTooling =
    Array.isArray(packages) &&
    packages.every(
      (pkg) =>
        (license === 'LGPL-3.0-or-later' &&
          pkg.name.startsWith('@img/sharp-libvips-') &&
          pkg.versions.every((version) =>
            ['1.3.1', '1.3.3'].includes(version),
          )) ||
        (license === 'MPL-2.0' &&
          (pkg.name === 'lightningcss' ||
            pkg.name.startsWith('lightningcss-')) &&
          pkg.versions.every((version) => version === '1.33.0')),
    );
  if (!allowed.has(license) && !reviewedDevTooling)
    failed.push({ license, packages });
}
if (failed.length) {
  console.error(
    'Review unapproved dependency licenses before merging:',
    JSON.stringify(failed, null, 2),
  );
  process.exitCode = 1;
} else
  console.log(`Approved ${Object.keys(report).length} license expressions.`);
