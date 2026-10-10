import { expect, it } from 'vitest';
import type { R2Bucket } from '@cloudflare/workers-types';
import { createBoundedMultipartReconciler } from '@hyperbug/application';
import { minimumInvocationBudget } from '../../apps/api-cloudflare/src/async-budget.ts';

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
