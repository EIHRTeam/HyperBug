import { expect, it } from 'vitest';
import { replayReceipt } from '@hyperbug/application';
const id = '00000000-0000-4000-8000-000000000001';
it('fails closed on corrupt or overbroad persisted replay results', () => {
  const intent = {
    mutationId: id,
    principalId: id,
    projectId: id,
    requestId: id,
    keyHash: 'a'.repeat(64),
    payloadHash: 'b'.repeat(64),
    now: 1000,
    expiresAt: 2000,
  };
  const result = {
    id,
    projectId: id,
    number: 1,
    revision: 1,
    createdAt: 1000,
    updatedAt: 1000,
  };
  const receipt = { payloadHash: intent.payloadHash, expiresAt: 2000, result };
  expect(replayReceipt(receipt, intent)).toEqual({ result, replayed: true });
  for (const corrupt of [
    null,
    {},
    { ...result, body: 'private' },
    { ...result, projectId: '00000000-0000-4000-8000-000000000002' },
    { ...result, updatedAt: 999 },
    { ...result, revision: 0 },
  ]) {
    expect(() =>
      replayReceipt({ ...receipt, result: corrupt }, intent),
    ).toThrow('Invalid persisted mutation receipt');
  }
});
