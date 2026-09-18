import { describe, expect, it } from 'vitest';
import {
  issuePage,
  issuePageOptions,
  validateIntent,
} from '@hyperbug/application';
import type { Issue } from '@hyperbug/domain';
const projectId = '00000000-0000-4000-8000-000000000001';
const issue: Issue = {
  id: '00000000-0000-4000-8000-000000000002',
  projectId,
  number: 1,
  title: 'A',
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
    };
    expect(() => validateIntent(intent)).not.toThrow();
    expect(() => validateIntent({ ...intent, title: '  ' })).toThrow(
      'INVALID_INPUT',
    );
    expect(() => validateIntent({ ...intent, expiresAt: 1000 })).toThrow(
      'INVALID_INPUT',
    );
    expect(() => validateIntent({ ...intent, expectedRevision: 0 })).toThrow(
      'INVALID_INPUT',
    );
  });
});
