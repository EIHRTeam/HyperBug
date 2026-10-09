import { expect, it } from 'vitest';
import {
  taskReference,
  validateTaskReference,
  asyncBackoff,
  asyncFailure,
  AsyncError,
} from '@hyperbug/application';
it('validates private stable references and closed versions without retaining supplied payloads', () => {
  const ref = taskReference('core', '00000000-0000-4000-8000-000000000001');
  expect(validateTaskReference(ref)).toEqual(ref);
  for (const value of [
    null,
    { ...ref, version: 2 },
    { ...ref, payload: 'credential' },
    { ...ref, jobId: 'other' },
  ])
    expect(() => validateTaskReference(value)).toThrow();
  expect([1, 2, 3, 4, 5].map(asyncBackoff)).toEqual([
    1000, 2000, 4000, 8000, 16000,
  ]);
  expect(asyncFailure(new Error('private provider response'))).toBe(
    'transient',
  );
  expect(asyncFailure(new AsyncError('permanent'))).toBe('permanent');
});
