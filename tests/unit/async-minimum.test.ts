import { expect, it } from 'vitest';
import type {
  D1Database,
  D1PreparedStatement,
  R2Bucket,
} from '@cloudflare/workers-types';
import { createBoundedMultipartReconciler } from '@hyperbug/application';
import { minimumInvocationBudget } from '../../apps/api-cloudflare/src/async-budget.ts';

it('Minimum meters bound first/all/run and batches once and refuses calls before I/O', async () => {
  let calls = 0;
  const value = {
    results: [{ id: 7 }],
    meta: { rows_read: 2, rows_written: 1 },
  };
  const statement = {
    bind() {
      return this;
    },
    async all() {
      calls++;
      return value;
    },
    async run() {
      calls++;
      return value;
    },
  } as unknown as D1PreparedStatement;
  const raw = {
    prepare: () => statement,
    async batch(items: D1PreparedStatement[]) {
      expect(items.every((item) => item === statement)).toBe(true);
      calls++;
      return items.map(() => value);
    },
  } as unknown as D1Database;
  const budget = minimumInvocationBudget(),
    db = budget.db(raw);
  expect(await db.prepare('first').bind(1).first('id')).toBe(7);
  await db.prepare('all').bind(2).all();
  await db.prepare('run').run();
  await db.batch(Array.from({ length: 37 }, () => db.prepare('batch').bind(3)));
  expect(budget.snapshot()).toEqual({
    queries: 40,
    subrequests: 40,
    reads: 80,
    writes: 40,
  });
  expect(calls).toBe(4);
  await expect(db.prepare('refused').all()).rejects.toMatchObject({
    reason: 'transient',
  });
  expect(calls).toBe(4);
  budget.diagnostics();
  await db.batch(Array.from({ length: 5 }, () => db.prepare('diagnostic')));
  expect(budget.snapshot().queries).toBe(45);
  await expect(db.prepare('refused').run()).rejects.toThrow();
  expect(calls).toBe(5);
  expect(() => db.prepare('raw').raw()).toThrow();
  expect(() => db.exec('bypass')).toThrow();
  expect(() => db.withSession()).toThrow();
});

it('Minimum rejects batch row amplification after accounting for every result', async () => {
  const statement = {} as D1PreparedStatement;
  const budget = minimumInvocationBudget();
  const db = budget.db({
    prepare: () => statement,
    async batch() {
      return [
        { results: [], meta: { rows_read: 2500, rows_written: 50 } },
        { results: [], meta: { rows_read: 2501, rows_written: 51 } },
      ];
    },
  } as unknown as D1Database);
  await expect(db.batch([db.prepare('a'), db.prepare('b')])).rejects.toThrow();
  expect(budget.snapshot()).toEqual({
    queries: 2,
    subrequests: 2,
    reads: 5001,
    writes: 101,
  });
});

it('Minimum stops a maximum-size multipart sweep before exceeding invocation subrequests', async () => {
  const budget = minimumInvocationBudget();
  let calls = 0,
    page = 0;
  const bucket = budget.bucket({
    async list() {
      calls++;
    },
    async delete() {
      calls++;
    },
  } as unknown as R2Bucket);
  const key = 'staging/' + 'a'.repeat(64);
  const reconciler = createBoundedMultipartReconciler({
    async list() {
      await bucket.list();
      const current = page++;
      return {
        truncated: current < 4,
        uploads: Array.from({ length: 20 }, (_, index) => ({
          key,
          id: `session-${current * 20 + index}`,
        })),
        groupedPrefixes: 0,
        nextKey: key,
        nextId: `page-${current}`,
      };
    },
    async abort() {
      await bucket.delete(key);
    },
  });
  await expect(
    reconciler.reconcile({ key, signal: new AbortController().signal }),
  ).rejects.toMatchObject({ code: 'BLOB_UNAVAILABLE' });
  expect(calls).toBe(40);
  expect(budget.snapshot().subrequests).toBe(40);
});
