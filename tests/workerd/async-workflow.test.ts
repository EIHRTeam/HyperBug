import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';

it('actual local Workflow retries committed steps, restarts, cancels and bounds output', async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures'], {
    stdio: 'pipe',
  });
  const persistence = await mkdtemp(join(tmpdir(), 'hyperbug-workflows-'));
  const options = convertV4MiniflareOptions({
    modules: workerModules('dist/async-workflow-worker'),
    compatibilityDate: '2026-09-16',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'async-workflow' },
    workflows: {
      FLOW: { name: 'async-conformance', className: 'CrashWorkflow' },
    },
  });
  options.resourcePersistencePath = persistence;
  let mf = new Miniflare(options);
  try {
    let db = await mf.getD1Database('DB');
    for (const migration of await migrationStatements('d1')) {
      // eslint-disable-next-line no-await-in-loop
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    }
    await db
      .prepare('CREATE TABLE workflow_crashes (id TEXT PRIMARY KEY)')
      .run();
    const id = crypto.randomUUID();
    const post = async (path: string, jobId = id) => {
      const response = await mf.dispatchFetch(
        `http://fixture/${path}?id=${jobId}`,
        { method: 'POST' },
      );
      expect(response.status, await response.text()).toBe(200);
    };
    await post('start');
    await expect
      .poll(
        async () =>
          (
            await db
              .prepare('SELECT id FROM workflow_crashes WHERE id=?')
              .bind(id)
              .all()
          ).results.length,
      )
      .toBe(1);
    await post('terminate');
    await mf.dispose();
    mf = new Miniflare(options);
    db = await mf.getD1Database('DB');
    await post('resume');
    await expect
      .poll(
        async () => {
          const response = await mf.dispatchFetch(`http://fixture/?id=${id}`);
          return ((await response.json()) as { job: { status: string } }).job
            .status;
        },
        { timeout: 10000 },
      )
      .toBe('completed');
    expect(
      (
        await db
          .prepare(
            'SELECT step FROM async_job_steps WHERE job_id=? ORDER BY step',
          )
          .bind(id)
          .all()
      ).results,
    ).toEqual([{ step: 0 }, { step: 1 }]);
    const result = (await (
      await mf.dispatchFetch(`http://fixture/?id=${id}`)
    ).json()) as { status: { output: unknown } };
    expect(JSON.stringify(result.status.output).length).toBeLessThanOrEqual(
      1024,
    );
    await post('resume');
    const cancelled = crypto.randomUUID();
    await post('start', cancelled);
    await post('cancel', cancelled);
    expect(
      (
        await db
          .prepare('SELECT status FROM async_jobs WHERE id=?')
          .bind(cancelled)
          .first()
      )?.status,
    ).toBe('cancelled');
  } finally {
    await mf.dispose();
    await rm(persistence, { recursive: true, force: true });
  }
}, 25000);
