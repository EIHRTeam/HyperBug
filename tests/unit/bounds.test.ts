import { expect, it } from 'vitest';
import { loadConfig } from '@hyperbug/config';
import { readBoundedJson } from '../../packages/server/src/bounds.ts';

it('enforces the deadline even if body cancellation never settles', async () => {
  const request = new Request('http://local.invalid', {
    method: 'POST',
    body: new ReadableStream({
      pull: () => new Promise(() => {}),
      cancel: () => new Promise(() => {}),
    }),
    duplex: 'half',
  } as RequestInit);
  await expect(
    readBoundedJson(
      request,
      1024,
      30,
      loadConfig(
        { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost' },
        'node',
      ).security.input,
    ),
  ).rejects.toMatchObject({
    code: 'REQUEST_TIMEOUT',
  });
}, 1000);
