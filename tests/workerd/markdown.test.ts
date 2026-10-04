import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import {
  markdownResults,
  markdownMeasurement,
} from '../fixtures/markdown-corpus.ts';
let mf: Miniflare;
beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/markdown-worker'),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat'],
    }),
  );
  await mf.ready;
});
afterAll(async () => {
  await mf?.dispose();
});
it('matches Node byte-for-byte for adversarial GFM, HTML and concurrent derivation', async () => {
  const expected = JSON.stringify(markdownResults());
  const outputs = await Promise.all(
    Array.from({ length: 8 }, async () =>
      (await mf.dispatchFetch('http://localhost/')).text(),
    ),
  );
  expect(outputs).toEqual(Array.from({ length: 8 }, () => expected));
});
it('records bounded maximum-body and full-page derivation wall time on Node and workerd', async () => {
  const node = markdownMeasurement();
  const worker = (await (
    await mf.dispatchFetch('http://localhost/measure')
  ).json()) as ReturnType<typeof markdownMeasurement>;
  for (const fixture of [...node, ...worker]) {
    expect(fixture.codePoints).toBe(32768);
    expect(fixture.singleMeanMs).toBeLessThan(1000);
    expect(fixture.page100Ms).toBeLessThan(8000);
  }
  console.log(
    JSON.stringify({ markdownDerivation: { node, workerd: worker } }),
  );
}, 30000);
