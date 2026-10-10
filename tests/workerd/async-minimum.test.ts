import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import {
  createD1AsyncStore,
  createD1MinimumAsyncStore,
} from '@hyperbug/database-d1';
import type { D1Database } from '@cloudflare/workers-types';
import { startMinimumJob } from '@hyperbug/application';

it('Minimum resumes D1 events/jobs across runtime restart, preserves exhausted backlog and enforces invocation/retention bounds', async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures'], {
    stdio: 'pipe',
  });
  const persistence = await mkdtemp(join(tmpdir(), 'hyperbug-minimum-'));
  const options = convertV4MiniflareOptions({
    modules: workerModules('dist/async-minimum-worker'),
    compatibilityDate: '2026-09-16',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'minimum-async' },
  });
  options.resourcePersistencePath = persistence;
  let mf = new Miniflare(options);
  try {
    let db = await mf.getD1Database('DB');
    for (const migration of await migrationStatements('d1')) {
      // eslint-disable-next-line no-await-in-loop
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    }
    let now = 2000000000000;
    const project = crypto.randomUUID(),
      event = crypto.randomUUID(),
      job = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO projects(id,slug,name,created_at,updated_at) VALUES (?,?,?,?,?)',
      )
      .bind(project, project, 'Minimum', now, now)
      .run();
    await db
      .prepare(
        "INSERT INTO outbox(id,project_id,aggregate_id,event_type,payload,created_at,available_at) VALUES (?,?,?,'comment.create','{}',?,?)",
      )
      .bind(event, project, crypto.randomUUID(), now, now)
      .run();
    await createD1MinimumAsyncStore(db as unknown as D1Database).claim(
      now,
      'crashed',
    );
    const raw = createD1AsyncStore(db as unknown as D1Database),
      jobs = { ...raw, claim: raw.claimJob };
    await expect(
      startMinimumJob(jobs, { kind: 'export', id: job, maxSteps: 2, now }),
    ).rejects.toThrow();
    await expect(
      startMinimumJob(jobs, { kind: 'conformance', id: job, maxSteps: 5, now }),
    ).rejects.toThrow();
    await startMinimumJob(jobs, {
      kind: 'conformance',
      id: job,
      maxSteps: 2,
      now,
    });
    const tick = async (phase: number) => {
      const response = await mf.dispatchFetch(
        `http://fixture/?phase=${phase}&now=${now}`,
      );
      expect(response.status).toBe(200);
      const report = (await response.json()) as {
        queries: number;
        subrequests: number;
        outcome: string;
        backlog: { pending: number; failed: number };
      };
      expect(report.queries).toBeLessThanOrEqual(45);
      expect(report.subrequests).toBeLessThanOrEqual(45);
      return report;
    };
    await tick(4);
    expect((await jobs.get(job))?.checkpoint).toBe(1);
    await mf.dispose();
    mf = new Miniflare(options);
    db = await mf.getD1Database('DB');
    now += 90001;
    expect((await tick(0)).outcome).toBe('done');
    expect(
      (
        await db
          .prepare('SELECT delivered_at FROM outbox WHERE id=?')
          .bind(event)
          .first()
      )?.delivered_at,
    ).toBe(now);
    await tick(4);
    expect(
      await db
        .prepare('SELECT status,checkpoint FROM async_jobs WHERE id=?')
        .bind(job)
        .first(),
    ).toEqual({ status: 'completed', checkpoint: 2 });
    expect(
      (
        await db
          .prepare(
            'SELECT step FROM async_job_steps WHERE job_id=? ORDER BY step',
          )
          .bind(job)
          .all()
      ).results,
    ).toEqual([{ step: 0 }, { step: 1 }]);
    const pending = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO outbox(id,project_id,aggregate_id,event_type,payload,created_at,available_at) VALUES (?,?,?,'comment.create','{}',?,?)",
      )
      .bind(pending, project, crypto.randomUUID(), now, now)
      .run();
    await db
      .prepare(
        'UPDATE async_minimum_budget SET reads=1500000,writes=30000 WHERE id=1',
      )
      .run();
    const exhausted = await tick(0);
    expect(exhausted.outcome).toBe('quota-exhausted');
    expect(exhausted.backlog.pending).toBeGreaterThanOrEqual(1);
    expect(
      (
        await db
          .prepare('SELECT delivered_at FROM outbox WHERE id=?')
          .bind(pending)
          .first()
      )?.delivered_at,
    ).toBeNull();
    now += 86400000;
    await tick(0);
    expect(
      (
        await db
          .prepare('SELECT delivered_at FROM outbox WHERE id=?')
          .bind(pending)
          .first()
      )?.delivered_at,
    ).toBe(now);
    await tick(1);
    await tick(2);
    now += 2592000001;
    await tick(3);
    expect(
      (await db.prepare('SELECT id FROM async_jobs WHERE id=?').bind(job).all())
        .results,
    ).toHaveLength(0);
  } finally {
    await mf.dispose();
    await rm(persistence, { recursive: true, force: true });
  }
}, 25000);
