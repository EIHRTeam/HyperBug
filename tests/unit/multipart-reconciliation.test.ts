import { it, expect, vi } from 'vitest';
import { type S3Client } from '@aws-sdk/client-s3';
import { createS3MultipartReconciler } from '@hyperbug/blob-s3';
import { createBoundedMultipartReconciler } from '@hyperbug/application';
import { blobKey } from '../fixtures/blob-store-proof.ts';

it.each([true, false])(
  'requires complete exact-key discovery and post-abort absence with key marker present: %s',
  async (withKeyMarker) => {
    const key = blobKey();
    const responses = [
      {
        IsTruncated: true,
        ...(withKeyMarker ? { NextKeyMarker: key } : {}),
        NextUploadIdMarker: 'one',
        Uploads: [{ Key: key, UploadId: 'one' }],
      },
      { IsTruncated: false, Uploads: [{ Key: key, UploadId: 'two' }] },
      {},
      {},
      { IsTruncated: false },
    ];
    const send = vi.fn(async () => responses.shift());
    const reconciler = createS3MultipartReconciler(
      { send } as unknown as S3Client,
      'test-bucket',
    );
    expect(
      await reconciler.reconcile({ key, signal: new AbortController().signal }),
    ).toEqual({ key, remainingUploads: 0 });
    expect(send).toHaveBeenCalledTimes(5);
    expect(
      (send.mock.calls[0] as unknown as { input: unknown }[])[0]!.input,
    ).toEqual({ Bucket: 'test-bucket', Prefix: key, MaxUploads: 20 });
    expect(
      (send.mock.calls[1] as unknown as { input: unknown }[])[0]!.input,
    ).toEqual({
      Bucket: 'test-bucket',
      Prefix: key,
      MaxUploads: 20,
      ...(withKeyMarker ? { KeyMarker: key } : {}),
      UploadIdMarker: 'one',
    });
  },
);
it('fails closed on wrong keys, incomplete/repeating/excessive pagination, malformed results and failed aborts', async () => {
  const key = blobKey(),
    signal = new AbortController().signal;
  const cases = [
    [
      {
        IsTruncated: true,
        NextKeyMarker: blobKey(),
        NextUploadIdMarker: 'one',
      },
    ],
    [
      {
        IsTruncated: false,
        Uploads: [{ Key: blobKey(), UploadId: 'private-id' }],
      },
    ],
    [{ IsTruncated: true }],
    [{ IsTruncated: false, Uploads: [{ Key: key, UploadId: 'bad\nid' }] }],
    [{ Uploads: [] }],
    [{ IsTruncated: false, CommonPrefixes: [{ Prefix: key }] }],
    [
      { IsTruncated: true, NextKeyMarker: key, NextUploadIdMarker: 'one' },
      { IsTruncated: true, NextKeyMarker: key, NextUploadIdMarker: 'one' },
    ],
    Array.from({ length: 5 }, (_, i) => ({
      IsTruncated: true,
      NextKeyMarker: key,
      NextUploadIdMarker: String(i),
    })),
    [
      {
        IsTruncated: false,
        Uploads: Array.from({ length: 21 }, (_, i) => ({
          Key: key,
          UploadId: String(i),
        })),
      },
    ],
    [
      { IsTruncated: false, Uploads: [{ Key: key, UploadId: 'one' }] },
      new Error('private provider URL'),
    ],
    [
      { IsTruncated: false },
      { IsTruncated: false, Uploads: [{ Key: key, UploadId: 'late' }] },
    ],
  ];
  for (const responses of cases) {
    const send = vi.fn(async () => {
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return result;
    });
    // Cases are independent and sequential; each refusal must map to a fixed bounded error.
    // eslint-disable-next-line no-await-in-loop
    await expect(
      createS3MultipartReconciler(
        { send } as unknown as S3Client,
        'test-bucket',
      ).reconcile({ key, signal }),
    ).rejects.toMatchObject({ message: 'BLOB_UNAVAILABLE' });
    expect(send.mock.calls.length).toBeLessThanOrEqual(5);
  }
  const controller = new AbortController();
  controller.abort();
  const send = vi.fn();
  await expect(
    createS3MultipartReconciler(
      { send } as unknown as S3Client,
      'test-bucket',
    ).reconcile({ key, signal: controller.signal }),
  ).rejects.toMatchObject({ code: 'BLOB_UNAVAILABLE' });
  expect(send).not.toHaveBeenCalled();
});

it.each(['list', 'abort'] as const)(
  'bounds a noncooperative provider during %s and stops subsequent I/O',
  async (stage) => {
    vi.useFakeTimers();
    try {
      const key = blobKey();
      const list = vi.fn(async () =>
        stage === 'list'
          ? new Promise<never>(() => {})
          : {
              truncated: false,
              uploads: [{ key, id: 'one' }],
              groupedPrefixes: 0,
              nextKey: undefined,
              nextId: undefined,
            },
      );
      const abort = vi.fn(async () => new Promise<never>(() => {}));
      const pending = createBoundedMultipartReconciler({
        list,
        abort,
      }).reconcile({ key, signal: new AbortController().signal });
      const refused = expect(pending).rejects.toMatchObject({
        message: 'BLOB_UNAVAILABLE',
      });
      await vi.advanceTimersByTimeAsync(30001);
      await refused;
      expect(list).toHaveBeenCalledTimes(1);
      expect(abort).toHaveBeenCalledTimes(stage === 'abort' ? 1 : 0);
    } finally {
      vi.useRealTimers();
    }
  },
);
