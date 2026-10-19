import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { BrowserAuth } from '../../apps/web/src/auth.ts';
const { QueryClient } = createRequire(
  new URL('../../apps/web/package.json', import.meta.url),
)('@tanstack/react-query') as {
  QueryClient: new () => ConstructorParameters<typeof BrowserAuth>[1];
};
import { ApiClientError } from '@hyperbug/api-client';
import {
  productQuery,
  validateIssueSearch,
  productError,
  type ProductRequest,
} from '../../apps/web/src/product-state.ts';
import {
  answerError,
  initialAnswers,
  type FormDocument,
} from '../../apps/web/src/issue-form-values.ts';
import { validateUploadDestination } from '../../apps/web/src/uploads.ts';

describe('product URL and cache boundaries', () => {
  it('rejects invalid URL values without truncating queries or widening unsupported sorts', () => {
    expect(
      validateIssueSearch({ q: 'state:open OR "quoted value"', after: 'abc' }),
    ).toEqual({
      q: 'state:open OR "quoted value"',
      after: 'abc',
      sort: 'created_desc',
    });
    for (const raw of [
      { q: '😀'.repeat(513) },
      { q: ['secret'] },
      { after: 'bad cursor' },
      { sort: 'relevance' },
    ])
      expect(validateIssueSearch(raw).invalid).toBeTypeOf('string');
  });
  it('deduplicates equal requests, partitions identities and cancels inactive work', async () => {
    const cache = new QueryClient();
    const request = vi.fn(async () => ({
      id: 'project',
    })) as unknown as ProductRequest;
    const input = { params: { projectId: 'project' } };
    const first = productQuery(
      request,
      'https://api.example',
      1,
      'GET /api/v1/projects/{projectId}',
      input,
    );
    await Promise.all([cache.fetchQuery(first), cache.fetchQuery(first)]);
    expect(request).toHaveBeenCalledTimes(1);
    await cache.fetchQuery(
      productQuery(
        request,
        'https://api.example',
        2,
        'GET /api/v1/projects/{projectId}',
        input,
      ),
    );
    expect(request).toHaveBeenCalledTimes(2);
    let signal: AbortSignal | undefined;
    const pending = productQuery(
      ((_operation, options) => {
        signal = options.signal;
        return new Promise(() => {});
      }) as ProductRequest,
      'https://api.example',
      3,
      'GET /api/v1/projects/{projectId}',
      input,
    );
    const work = cache.fetchQuery(pending).catch(() => undefined);
    await cache.cancelQueries({ queryKey: pending.queryKey });
    await work;
    expect(signal?.aborted).toBe(true);
    cache.clear();
  });
  it('uses fixed safe copy for errors and preserves ambiguous-retry guidance', () => {
    expect(productError(new Error('private payload'))).not.toContain(
      'private payload',
    );
    expect(
      productError(new ApiClientError(409, 'REVISION_CONFLICT')),
    ).toContain('Reload');
    expect(
      productError(new ApiClientError(0, 'TIMEOUT', null, true)),
    ).toContain('unchanged submission');
    expect(productError(new ApiClientError(400, 'SEARCH_SYNTAX'))).toContain(
      'syntax',
    );
  });
});

describe('form answer constraints', () => {
  const definition = {
    definition: {
      body: [
        {
          type: 'input',
          id: 'title',
          attributes: { value: 'default' },
          validations: { required: true, min_length: 3 },
        },
        {
          type: 'dropdown',
          id: 'version',
          attributes: { options: ['one', 'two'], default: 1, multiple: false },
          validations: { required: true },
        },
        {
          type: 'checkboxes',
          id: 'terms',
          attributes: { options: [{ label: 'Accept', required: true }] },
          validations: { required: false },
        },
        {
          type: 'upload',
          id: 'file',
          attributes: {},
          validations: { required: true, accept: '.png' },
        },
      ],
    },
  } as unknown as FormDocument;
  it('initializes server defaults deterministically and checks required options', () => {
    expect(initialAnswers(definition)).toEqual({
      title: 'default',
      version: 'two',
      terms: [],
      file: [],
    });
    expect(
      answerError(definition.definition.body[0]!, 'あいう'),
    ).toBeUndefined();
    expect(answerError(definition.definition.body[0]!, '')).toContain(
      'required',
    );
    expect(answerError(definition.definition.body[2]!, [])).toContain(
      'required checkbox',
    );
    expect(answerError(definition.definition.body[2]!, [0])).toBeUndefined();
    expect(answerError(definition.definition.body[3]!, [])).toBeDefined();
  });
});

it('sends upload bytes only to explicitly configured capability origins without credential headers', () => {
  const capability = {
    method: 'PUT' as const,
    url: 'https://storage.example/object?signature=temporary',
    headers: { 'content-type': 'image/png' },
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  expect(
    validateUploadDestination(capability, ['https://storage.example']),
  ).toBe(capability.url);
  expect(() => validateUploadDestination(capability, [])).toThrow();
  expect(() =>
    validateUploadDestination(
      { ...capability, headers: { authorization: 'Bearer forbidden' } },
      ['https://storage.example'],
    ),
  ).toThrow();
  expect(() =>
    validateUploadDestination(
      { ...capability, url: 'https://user:password@storage.example/object' },
      ['https://storage.example'],
    ),
  ).toThrow();
  expect(() =>
    validateUploadDestination(
      { ...capability, expiresAt: new Date(0).toISOString() },
      ['https://storage.example'],
    ),
  ).toThrow();
});
