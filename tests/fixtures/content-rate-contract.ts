import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { expect } from 'vitest';
import { loadConfig } from '@hyperbug/config';
import { createApp } from '@hyperbug/server';
import {
  SecretAbuseKeyProvider,
  type RateCounterStore,
} from '../../packages/security/src/index.ts';
import { abuseKeyFixture } from './abuse-key-fixture.ts';

export async function contentRateContract(
  store: RateCounterStore,
  query: (sql: string) => Promise<Record<string, unknown>[]>,
) {
  let serialized = abuseKeyFixture();
  let approximate = 0;
  let sheddingUnavailable = false;
  const app = createApp({
    adapter: CloudflareAdapter,
    ready: async () => true,
    config: loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
    telemetry: { request() {} },
    abuse: {
      provider: new SecretAbuseKeyProvider({ read: async () => serialized }),
      store,
      limiter: {
        consume: async () => {
          approximate++;
          if (sheddingUnavailable)
            return { allowed: false, reason: 'unavailable' as const };
          return { allowed: true };
        },
      },
      clientAddress: () => '192.0.2.48',
    },
  });
  const rule = { limit: 2, windowMs: 60_000, retentionMs: 86_400_000 };
  for (const category of [
    'issue-create',
    'comment-create',
    'reaction',
    'registration',
  ] as const) {
    app.post('/_proof/' + category, async ({ request, sensitiveAdmission }) => {
      await sensitiveAdmission.requireRate({
        request,
        category,
        checks:
          category === 'registration'
            ? [
                {
                  dimension: 'account',
                  canonicalSubject: 'fixed-fixture',
                  rule,
                },
                { dimension: 'ip', rule },
              ]
            : [
                {
                  dimension: 'principal',
                  canonicalSubject: 'fixed-principal',
                  rule,
                },
                {
                  dimension: 'project',
                  canonicalSubject: 'fixed-project',
                  rule,
                },
              ],
        nowMs: 2_000_000_040_000,
        signal: request.signal,
        timeoutMs: 1000,
      });
      return { admitted: true };
    });
  }
  app.compile();
  const request = (category: string) =>
    app.handle(
      new Request('http://localhost/_proof/' + category, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
  for (const category of ['issue-create', 'comment-create', 'reaction']) {
    for (const status of [200, 200, 429])
      expect((await request(category)).status).toBe(status);
    const rows = await query(
      `SELECT dimension, key_version, hits AS count FROM rate_limit_counters WHERE category = '${category}'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dimension: 'principal',
      key_version: 2,
      count: 3,
    });
  }
  expect(approximate).toBe(18);
  const ring = JSON.parse(serialized);
  ring.current = 3;
  ring.keys.unshift({
    version: 3,
    material: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
      'base64url',
    ),
  });
  serialized = JSON.stringify(ring);
  expect((await request('issue-create')).status).toBe(200);
  const rotated = await query(
    "SELECT key_version, hits AS count FROM rate_limit_counters WHERE category = 'issue-create' ORDER BY key_version",
  );
  expect(rotated).toEqual([
    { key_version: 2, count: 3 },
    { key_version: 3, count: 1 },
  ]);
  expect((await request('registration')).status).toBe(200);
  const identity = await query(
    "SELECT dimension, key_version, hits AS count FROM rate_limit_counters WHERE category = 'registration'",
  );
  expect(identity).toHaveLength(6);
  expect(identity.every((r) => Number(r.count) === 1)).toBe(true);
  sheddingUnavailable = true;
  expect((await request('comment-create')).status).toBe(503);
  expect(
    await query(
      "SELECT hits AS count FROM rate_limit_counters WHERE category = 'comment-create'",
    ),
  ).toEqual([{ count: 3 }]);
}
