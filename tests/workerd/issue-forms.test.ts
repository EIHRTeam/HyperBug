import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { issueFormCorpusResults } from '../fixtures/issue-form-corpus.ts';
let mf: Miniflare;
beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/issue-form-worker'),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat'],
    }),
  );
  await mf.ready;
});
afterAll(async () => {
  await mf?.dispose();
});
it('validates the entire YAML/answer corpus and emits byte-identical definitions and Markdown in workerd', async () => {
  const expected = JSON.stringify(issueFormCorpusResults());
  const responses = await Promise.all(
    Array.from({ length: 8 }, async () =>
      (await mf.dispatchFetch('http://localhost/')).text(),
    ),
  );
  expect(responses).toEqual(Array.from({ length: 8 }, () => expected));
});
