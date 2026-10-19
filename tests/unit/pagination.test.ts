import { searchParserContract } from '../fixtures/search-contract.ts';
import { parseSearchQuery } from '@hyperbug/application';
searchParserContract(parseSearchQuery);
import { describe, expect, it } from 'vitest';
import {
  issuePage,
  issuePageOptions,
  validateIntent,
  type EditIssueIntent,
} from '@hyperbug/application';
import type { Issue } from '@hyperbug/domain';
const projectId = '00000000-0000-4000-8000-000000000001';
const issue: Issue = {
  id: '00000000-0000-4000-8000-000000000002',
  projectId,
  number: 1,
  title: 'A',
  bodyText: null,
  bodyTextVersion: null,
  body: '',
  state: 'open',
  closeReason: null,
  typeId: null,
  milestoneId: null,
  moderation: 'visible',
  deletedAt: null,
  authorId: projectId,
  revision: 1,
  createdAt: 1000,
  updatedAt: 1000,
  closedAt: null,
};
describe('bounded versioned pagination', () => {
  it('binds cursors to project, filters, sort and tie-breaker', () => {
    const page = issuePage({ projectId, limit: 1 }, [
      issue,
      { ...issue, id: projectId },
    ]);
    const after = page.nextCursor ?? '';
    expect(issuePageOptions({ projectId, after }).cursor).toMatchObject({
      id: issue.id,
      time: 1000,
    });
    expect(() =>
      issuePageOptions({ projectId, state: 'closed', after }),
    ).toThrow('INVALID_CURSOR');
    expect(() => issuePageOptions({ projectId: issue.id, after })).toThrow(
      'INVALID_CURSOR',
    );
  });
  it('rejects invalid limits, malformed/overlong cursors and retired versions', () => {
    for (const limit of [0, 101, 1.5, Infinity])
      expect(() => issuePageOptions({ projectId, limit })).toThrow(
        'INVALID_INPUT',
      );
    for (const after of ['', '???', 'a'.repeat(1025), btoa('{"v":1}')])
      expect(() => issuePageOptions({ projectId, after })).toThrow(
        'INVALID_CURSOR',
      );
    expect(() =>
      issuePageOptions({
        projectId,
        after: btoa('{"v":2}').replace(/=+$/, ''),
      }),
    ).toThrow('CURSOR_STALE');
    expect(issuePage({ projectId }, [issue]).nextCursor).toBeNull();
  });
  it('validates persistence intents before any SQL work', () => {
    const intent = {
      ...issue,
      mutationId: issue.id,
      principalId: projectId,
      keyHash: 'a'.repeat(64),
      payloadHash: 'b'.repeat(64),
      now: 1000,
      expiresAt: 2000,
      requestId: projectId,
      labelIds: [],
      assigneeIds: [],
    };
    expect(() => validateIntent(intent, 'issue.create')).not.toThrow();
    expect(() =>
      validateIntent({ ...intent, title: '  ' }, 'issue.create'),
    ).toThrow('INVALID_INPUT');
    expect(() =>
      validateIntent({ ...intent, expiresAt: 1000 }, 'issue.create'),
    ).toThrow('INVALID_INPUT');
    expect(() =>
      validateIntent(
        { ...intent, expectedRevision: 0 } as unknown as EditIssueIntent,
        'issue.edit',
      ),
    ).toThrow('INVALID_INPUT');
  });
});

import {
  searchIssues,
  reindexSearch,
  type SearchContext,
} from '../../packages/server/src/search.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import {
  digestCredential,
  generateOpaqueCredential,
} from '../../packages/security/src/index.ts';
import { tokenContext } from '../../packages/server/src/oauth.ts';
import {
  authorizationPolicy,
  createDbAuthorizationResolver,
} from '../../packages/server/src/authorization-facts.ts';
import { bindDeadlinePolicy } from '../../packages/server/src/bounds.ts';
import { searchAvailability } from '@hyperbug/application';

it('requires a current administrator and fresh token for each bounded operator reindex', async () => {
  const { provider } = cryptoFixture(),
    tokenId = crypto.randomUUID(),
    secret = generateOpaqueCredential();
  const digest = JSON.stringify(
    await digestCredential(provider, secret, tokenContext(tokenId)),
  );
  let role: 'administrator' | 'maintainer' | null = 'administrator',
    authenticatedAtMs = Date.now(),
    writes = 0;
  const unexpected = async (): Promise<never> => {
    throw new Error('Unexpected store operation');
  };
  const context: SearchContext = {
    tier: 'cloudflare-minimum',
    keyProvider: provider,
    tokenStore: {
      loadActive: async () => ({
        id: tokenId,
        digest,
        principalId: projectId,
        identityId: tokenId,
        clientId: 'search-operator',
        scope: 'public-api',
        authMethod: 'passkey',
        authenticatedAtMs,
        assurance: 2,
      }),
      insert: unexpected,
      insertAccessToken: unexpected,
      revoke: unexpected,
      consume: unexpected,
      loadPrincipalKind: unexpected,
    },
    roleStore: null,
    administration: null,
    taxonomy: null,
    projects: {
      load: async () => ({
        id: projectId,
        slug: 'search-operator',
        name: 'Search operator',
        visibility: 'public',
        status: 'active',
        revision: 1,
        nextIssueNumber: 1,
        createdAtMs: 1,
        updatedAtMs: 1,
      }),
      create: unexpected,
      loadBySlug: unexpected,
      configure: unexpected,
      archive: unexpected,
    },
    authorizationPolicy,
    authorizationResolver: createDbAuthorizationResolver({
      loadPrincipal: async () => ({
        kind: 'staff',
        status: 'active',
        credentialActive: true,
      }),
      loadProject: async () => ({ visibility: 'public', state: 'active' }),
      loadMembership: async () => (role ? { role } : null),
      loadInstanceRole: async () => null,
    }),
    search: null,
    admission: { requireRate: async () => {} },
    index: {
      ready: async () => true,
      revisionOf: async () => null,
      backfill: async (query) => {
        expect(query.tier).toBe('cloudflare-minimum');
        expect(query.limit).toBe(1);
        writes++;
        return { processed: 1, updated: 1, rejectedIds: [], nextCursor: null };
      },
    },
  };
  const request = () =>
    new Request('https://api.example/operator', {
      headers: { authorization: `Bearer at_${tokenId}.${secret}` },
    });
  expect(
    (await reindexSearch(request(), context, projectId, { limit: 1 })).updated,
  ).toBe(1);
  role = 'maintainer';
  await expect(
    reindexSearch(request(), context, projectId, { limit: 1 }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  role = 'administrator';
  authenticatedAtMs = Date.now() - 600000;
  await expect(
    reindexSearch(request(), context, projectId, { limit: 1 }),
  ).rejects.toMatchObject({ code: 'REAUTHENTICATION_REQUIRED' });
  expect(writes).toBe(1);
  // Search deadlines produce a search-specific availability failure and no fallback scan.
  const unavailable: SearchContext = {
    ...context,
    search: { search: () => new Promise(() => {}) },
  };
  const timed = request();
  bindDeadlinePolicy(timed.signal, {
    readMs: 10,
    writeMs: 10,
    securityMs: 1000,
  });
  await expect(
    searchIssues(timed, unavailable, projectId, {}),
  ).rejects.toMatchObject({ code: 'SEARCH_UNAVAILABLE' });
  expect(
    searchAvailability(
      new Error('D1_ERROR: daily read limits have been exceeded'),
    ).code,
  ).toBe('SEARCH_BUDGET_EXHAUSTED');
  expect(
    searchAvailability(new Error('private database implementation detail'))
      .code,
  ).toBe('SEARCH_UNAVAILABLE');
});
