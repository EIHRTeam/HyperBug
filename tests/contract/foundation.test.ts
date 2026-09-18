import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EchoSchema, ErrorSchema, HealthSchema } from '@hyperbug/contracts';
it('publishes JSON schemas without a server implementation dependency', () => {
  for (const schema of [EchoSchema, ErrorSchema, HealthSchema]) {
    expect(JSON.parse(JSON.stringify(schema)).type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
  }
  const manifest = JSON.parse(
    readFileSync('packages/contracts/package.json', 'utf8'),
  );
  expect(Object.keys(manifest.dependencies)).toEqual(['@sinclair/typebox']);
});
