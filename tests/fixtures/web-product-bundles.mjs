import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = 'apps/web/dist';
const manifestText = await readFile(`${root}/.vite/manifest.json`, 'utf8');
const manifest = JSON.parse(manifestText);
const measurements = new Map();
const cssFiles = [
  ...new Set(Object.values(manifest).flatMap((entry) => entry.css ?? [])),
];
await Promise.all(
  [
    ...new Set([
      ...Object.values(manifest).map((entry) => entry.file),
      ...cssFiles,
    ]),
  ].map(async (file) => {
    const body = await readFile(`${root}/${file}`);
    measurements.set(file, {
      file,
      bytes: body.length,
      gzipBytes: gzipSync(body).length,
      sha256: createHash('sha256').update(body).digest('hex'),
    });
  }),
);
function route(...roots) {
  const files = new Set(cssFiles);
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    const entry = manifest[key];
    if (!entry) throw new Error(`Missing build entry: ${key}`);
    files.add(entry.file);
    for (const dependency of entry.imports ?? []) visit(dependency);
  }
  for (const key of ['index.html', 'src/app.tsx', ...roots]) visit(key);
  return {
    files: [...files],
    bytes: [...files].reduce(
      (sum, file) => sum + measurements.get(file).bytes,
      0,
    ),
    gzipBytes: [...files].reduce(
      (sum, file) => sum + measurements.get(file).gzipBytes,
      0,
    ),
  };
}
const report = {
  scope:
    'Production build artifact sizes; sums of independently gzipped files, including shared shell and CSS, excluding HTML/config and optional dynamic imports unless named. No hosted transfer, field CWV or SLO claim.',
  manifestSha256: createHash('sha256').update(manifestText).digest('hex'),
  routes: {
    list: route('src/routes/project.tsx'),
    detail: route('src/routes/issue.tsx'),
    staffDetail: route('src/routes/issue.tsx', 'src/components/triage.tsx'),
    create: route('src/routes/new-issue.tsx'),
    management: route('src/routes/manage.tsx'),
    audit: route('src/routes/manage.tsx', 'src/components/audit-browser.tsx'),
    plugins: route('src/routes/plugins-admin.tsx'),
  },
  assets: [...measurements.values()].sort((a, b) =>
    a.file.localeCompare(b.file),
  ),
};
await writeFile(
  'docs/plan/evidence/12-bundles.json',
  JSON.stringify(report, null, 2) + '\n',
);
for (const [name, value] of Object.entries(report.routes))
  console.log(
    `${name}: ${value.bytes} bytes raw / ${value.gzipBytes} bytes gzip (${value.files.length} files)`,
  );
