import { it, expect } from 'vitest';
import {
  createUploadCorsRules,
  validateUploadCorsRules,
} from '@hyperbug/application';

it('prepares exact shared R2/S3 CORS and denies wildcard, credential, path and insecure origins', () => {
  const origins = ['https://issues.example', 'https://staff.example'];
  const rules = createUploadCorsRules(origins);
  expect(() =>
    validateUploadCorsRules(rules, [...origins].reverse()),
  ).not.toThrow();
  for (const bad of [
    [],
    ['*'],
    ['https://*.example'],
    ['null'],
    ['https://user:secret@example'],
    ['https://example/'],
    ['https://example/path'],
    ['http://example'],
    ['http://127.0.0.1:3000'],
    [origins[0]!, origins[0]!],
  ])
    expect(() => createUploadCorsRules(bad)).toThrow();
  expect(() =>
    createUploadCorsRules(['http://127.0.0.1:3000'], true),
  ).not.toThrow();
  expect(() => createUploadCorsRules(['http://example'], true)).toThrow();
  for (const patch of [
    { AllowedOrigins: ['*'] },
    { AllowedHeaders: ['*'] },
    { AllowedMethods: ['PUT', 'GET', 'HEAD', 'DELETE'] },
    { ExposeHeaders: [] },
    { MaxAgeSeconds: 3600 },
    { AllowCredentials: true },
  ])
    expect(() =>
      validateUploadCorsRules([{ ...rules[0], ...patch }], origins),
    ).toThrow();
  expect(() =>
    validateUploadCorsRules([...rules, ...rules], origins),
  ).toThrow();
});
