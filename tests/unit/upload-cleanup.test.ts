import { it, expect, vi } from 'vitest';
import { reconcileUnknownMultipart } from '@hyperbug/application';
import { blobKey } from '../fixtures/blob-store-proof.ts';

it('unknown multipart reconciliation refuses malformed or incomplete proof and bounds callback time', async () => {
  const key = blobKey();
  for (const proof of [
    { key, remainingUploads: 1 },
    { key, remainingUploads: 0, extra: true },
    { key: blobKey(), remainingUploads: 0 },
    null,
  ]) {
    await expect(
      reconcileUnknownMultipart({ reconcile: async () => proof as never }, key),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
  }
  await expect(
    reconcileUnknownMultipart(
      {
        reconcile: async () => {
          throw new Error('private provider detail');
        },
      },
      key,
    ),
  ).rejects.toMatchObject({ message: 'UPLOAD_UNAVAILABLE' });
  vi.useFakeTimers();
  try {
    let signal: AbortSignal | undefined;
    let resolveLate: (value: {
      key: string;
      remainingUploads: 0;
    }) => void = () => {};
    const pending = reconcileUnknownMultipart(
      {
        reconcile: async (input) => {
          signal = input.signal;
          return new Promise((resolve) => {
            resolveLate = resolve;
          });
        },
      },
      key,
    );
    const denied = expect(pending).rejects.toMatchObject({
      code: 'UPLOAD_UNAVAILABLE',
    });
    await vi.advanceTimersByTimeAsync(30000);
    await denied;
    expect(signal?.aborted).toBe(true);
    resolveLate({ key, remainingUploads: 0 });
    await vi.advanceTimersByTimeAsync(1);
  } finally {
    vi.useRealTimers();
  }
});
