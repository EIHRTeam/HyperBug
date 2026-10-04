import { expect } from 'vitest';
import type { AccountSessionStore } from '@hyperbug/application';
import {
  currentAccountSession,
  issueSessionCookieFor,
  revokeAccountSession,
} from '../../packages/server/src/account-session.ts';
import { cryptoFixture } from './crypto-scenarios.ts';

export async function sessionRenewalContract(
  query: (
    sql: string,
    values?: (string | number)[],
  ) => Promise<Record<string, unknown>[]>,
  store: AccountSessionStore,
) {
  const provider = cryptoFixture().provider,
    start = Date.now(),
    idleMs = 1_800_000;
  for (const kind of ['user', 'staff'] as const) {
    const principalId = crypto.randomUUID(),
      identityId = crypto.randomUUID();
    const passwordRecord = {
      v: 1,
      alg: 'Argon2id',
      memoryKiB: 19456,
      passes: 2,
      parallelism: 1,
      salt: 'AQEBAQEBAQEBAQEBAQEBAQ',
      verifier: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
    };
    await query(
      'INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, ?, ?, ?)',
      [principalId, kind, 'Renewal fixture', start],
    );
    await query(
      "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES (?, ?, 'local-password', 'hyperbug', ?, ?)",
      [identityId, principalId, 'renewal_' + kind, start],
    );
    await query(
      'INSERT INTO password_credentials (identity_id, record, revision, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
      [identityId, JSON.stringify(passwordRecord), start, start],
    );
    let touches = 0,
      loads = 0;
    const counted: AccountSessionStore = {
      ...store,
      load: async (id, nowMs) => {
        loads++;
        return store.load(id, nowMs);
      },
      touch: async (input) => {
        touches++;
        return store.touch(input);
      },
    };
    const cookie = await issueSessionCookieFor({
      account: { principalId, identityId, credentialRevision: 1 },
      ceremony: { method: 'password', assurance: 1 },
      provider,
      store,
      signal: new AbortController().signal,
      nowMs: start,
    });
    const pair = cookie.split(';')[0]!,
      id = pair.split('=')[1]!.split('.')[0]!;
    const request = () =>
      new Request('https://auth.fixture/auth/session', {
        headers: { cookie: pair },
      });
    const validate = (nowMs: number) =>
      currentAccountSession({
        request: request(),
        provider,
        store: counted,
        nowMs,
      });
    const interval = kind === 'staff' ? 180_000 : 300_000;
    for (let i = 0; i < 3; i++)
      expect(await validate(start + interval - 1)).toMatchObject({
        principalId,
        authenticatedAtMs: start,
        assurance: 1,
      });
    expect(loads).toBe(3);
    expect(touches).toBe(0);
    expect(await validate(start + interval)).not.toBeNull();
    expect(touches).toBe(1);
    expect(await validate(start + interval + 1)).not.toBeNull();
    expect(touches).toBe(1);
    const nearExpiry = start + interval + idleMs - 1;
    expect(await validate(nearExpiry)).toMatchObject({
      authenticatedAtMs: start,
    });
    expect(touches).toBe(2);
    expect((await store.load(id, nearExpiry))?.idleExpiresAtMs).toBe(
      nearExpiry + idleMs,
    );
    // Concurrent renewals remain monotonic; each tab validates on the primary.
    const concurrent = await Promise.all([
      validate(nearExpiry + interval),
      validate(nearExpiry + interval),
    ]);
    expect(concurrent.every(Boolean)).toBe(true);
    expect((await store.load(id, nearExpiry + interval))?.idleExpiresAtMs).toBe(
      nearExpiry + interval + idleMs,
    );
    const absoluteExpiry = (await store.load(id, nearExpiry + interval))!
      .absoluteExpiresAtMs;
    await query(
      'UPDATE authorization_sessions SET idle_expires_at = absolute_expires_at WHERE id = ?',
      [id],
    );
    const beforeAbsoluteCheck = touches;
    expect(await validate(absoluteExpiry - 1)).not.toBeNull();
    expect(touches).toBe(beforeAbsoluteCheck);
    const writes = touches;
    if (kind === 'user')
      await revokeAccountSession({
        request: request(),
        provider,
        store,
        nowMs: nearExpiry + interval + 1,
      });
    else
      expect(
        await store.revokeOwned(id, principalId, nearExpiry + interval + 1),
      ).toBe(true);
    expect(await validate(nearExpiry + interval + 2)).toBeNull();
    expect(touches).toBe(writes);
    const secondCookie = await issueSessionCookieFor({
      account: { principalId, identityId, credentialRevision: 1 },
      ceremony: { method: 'password', assurance: 1 },
      provider,
      store,
      signal: new AbortController().signal,
      nowMs: start,
    });
    await query(
      'UPDATE password_credentials SET revision = revision + 1 WHERE identity_id = ?',
      [identityId],
    );
    expect(
      await currentAccountSession({
        request: new Request('https://auth.fixture/auth/session', {
          headers: { cookie: secondCookie.split(';')[0]! },
        }),
        provider,
        store: counted,
        nowMs: start + 1,
      }),
    ).toBeNull();
    expect(touches).toBe(writes);
  }
}
