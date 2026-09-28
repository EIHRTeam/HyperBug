import { expect, it } from 'vitest';
import { progressiveAccountDelayMs } from '../../packages/security/src/account-delay.ts';

const policy = {
  initialMs: 1000,
  maximumMs: 30000,
  failuresPerStep: 2,
};

it('grows the minimum-tier delay in bounded steps without overflow', () => {
  expect(
    [0, 1, 2, 3, 4, 5, 11].map((count) =>
      progressiveAccountDelayMs(count, policy),
    ),
  ).toEqual([0, 1000, 1000, 2000, 2000, 4000, 30000]);
  expect(progressiveAccountDelayMs(2147483647, policy)).toBe(30000);
});

it('rejects invalid persisted counts and unbounded delay policies', () => {
  for (const count of [-1, 0.5, Number.NaN, 2147483648])
    expect(() => progressiveAccountDelayMs(count, policy)).toThrow();
  for (const invalid of [
    { ...policy, initialMs: 0 },
    { ...policy, maximumMs: 86400001 },
    { ...policy, maximumMs: 999 },
    { ...policy, failuresPerStep: 0 },
  ])
    expect(() => progressiveAccountDelayMs(1, invalid)).toThrow();
});
