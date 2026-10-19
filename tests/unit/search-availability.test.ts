import { expect, it } from 'vitest';
import { SearchError, searchAvailability } from '@hyperbug/application';

it.each([
  'D1_ERROR: daily read limits have been exceeded',
  'DAILY EXCEEDED',
  'quota',
  'WRITE limits exceeded',
  'read limits exceeded',
  'readailyexceed',
  'dailywritexceed',
  'read\u0085limit exceeded',
  'unrelated\nQUOTA',
])(
  'classifies provider budget exhaustion without exposing details: %s',
  (message) => {
    const error = searchAvailability(new Error(message));
    expect(error.code).toBe('SEARCH_BUDGET_EXHAUSTED');
    expect(error.message).toBe('SEARCH_BUDGET_EXHAUSTED');
  },
);

it.each([
  'private database implementation detail',
  'limit exceeded before read',
  'write exceeded limit',
  'daily',
  'readlimit',
  ...['\n', '\r', '\u2028', '\u2029'].flatMap((separator) => [
    `daily${separator}limit`,
    `read${separator}limit exceeded`,
    `write limit${separator}exceeded`,
  ]),
])('keeps unrelated and cross-line errors unavailable: %s', (message) => {
  const error = searchAvailability(new Error(message));
  expect(error.code).toBe('SEARCH_UNAVAILABLE');
  expect(error.message).toBe('SEARCH_UNAVAILABLE');
});

it('preserves typed failures and treats non-Error input as unavailable', () => {
  const error = new SearchError('SEARCH_INDEX_INCOMPLETE');
  expect(searchAvailability(error)).toBe(error);
  for (const value of [null, 'quota', { message: 'quota' }])
    expect(searchAvailability(value).code).toBe('SEARCH_UNAVAILABLE');
});

it('handles repeated malicious prefixes and late legitimate quota markers promptly', () => {
  for (const prefix of ['daily', 'read', 'readlimit']) {
    const message = prefix.repeat(100_000);
    expect(searchAvailability(new Error(message)).code).toBe(
      'SEARCH_UNAVAILABLE',
    );
    expect(searchAvailability(new Error(message + ' quota')).code).toBe(
      'SEARCH_BUDGET_EXHAUSTED',
    );
  }
  expect(
    searchAvailability(
      new Error('read '.repeat(100_000) + 'limit '.repeat(100_000)),
    ).code,
  ).toBe('SEARCH_UNAVAILABLE');
}, 1000);
