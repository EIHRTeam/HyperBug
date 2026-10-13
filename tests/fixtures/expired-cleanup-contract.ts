import { expect, it } from 'vitest';
import type { ExpiredCleanupStore } from '@hyperbug/application';
import type { RepositoryHarness } from './repository-contract.ts';

export function expiredCleanupContract(
  get: () => { harness: RepositoryHarness; store: ExpiredCleanupStore },
  includeLockouts = true,
) {
  it('bounds expired cleanup, keeps live and retained credentials, and is repeatable', async () => {
    const { harness: h, store } = get();
    const principal = crypto.randomUUID(),
      identity = crypto.randomUUID(),
      project = crypto.randomUUID();
    await h.query(
      "INSERT INTO principals (id,kind,display_name,created_at) VALUES (?,'user','Cleanup',0)",
      [principal],
    );
    await h.query(
      "INSERT INTO identities (id,principal_id,provider,issuer,subject,created_at) VALUES (?,?,'local','cleanup',?,0)",
      [identity, principal, identity],
    );
    await h.query(
      "INSERT INTO projects (id,slug,name,created_at,updated_at) VALUES (?,?,'Cleanup',0,0)",
      [project, project],
    );
    const tables = [
      'authorization_sessions',
      'oauth_codes',
      'oauth_access_tokens',
      'webauthn_challenges',
      'mutation_receipts',
      'rate_limit_counters',
    ];
    if (includeLockouts) tables.push('account_lockouts');
    const ids: string[] = [];
    for (const expiry of [990000, 990000, 990000, 999500, 2000000]) {
      const id = crypto.randomUUID();
      ids.push(id);
      const created = expiry - 300000,
        hash = id.replaceAll('-', '').padEnd(64, '0');
      await h.query(
        "INSERT INTO authorization_sessions (id,principal_id,identity_id,credential_revision,digest,created_at,idle_expires_at,absolute_expires_at,authenticated_at) VALUES (?,?,?,1,'{}',?,?,?,?)",
        [id, principal, identity, created, expiry, expiry + 1000, created],
      );
      await h.query(
        "INSERT INTO oauth_codes (id,digest,client_id,redirect_uri,scope,code_challenge,principal_id,identity_id,created_at,expires_at,authenticated_at) VALUES (?,'{}','test','https://example.test/','read',?,?,?,?,?,?)",
        [
          id,
          'a'.repeat(43),
          principal,
          identity,
          expiry - 60000,
          expiry,
          expiry - 60000,
        ],
      );
      await h.query(
        "INSERT INTO oauth_access_tokens (id,digest,principal_id,identity_id,client_id,scope,created_at,expires_at,authenticated_at) VALUES (?,'{}',?,?,'test','read',?,?,?)",
        [id, principal, identity, created, expiry, created],
      );
      await h.query(
        "INSERT INTO webauthn_challenges (id,kind,challenge,created_at,expires_at) VALUES (?,'authentication',?,?,?)",
        [id, id, created, expiry],
      );
      await h.query(
        "INSERT INTO mutation_receipts (id,principal_id,project_id,operation,key_hash,payload_hash,result,created_at,expires_at) VALUES (?,?,?,'issue.create',?,?,'{}',?,?)",
        [id, principal, project, hash, hash, created, expiry],
      );
      if (includeLockouts)
        await h.query(
          'INSERT INTO account_lockouts (key_version,subject_digest,failed_attempts,not_before,expires_at) VALUES (1,?,1,?,?)',
          [hash, created, expiry],
        );
      await h.query(
        "INSERT INTO rate_limit_counters (category,dimension,key_version,subject_digest,window_start,hits,expires_at) VALUES ('login','account',1,?,?,1,?)",
        [hash, created, expiry],
      );
    }
    // A live session revoked long ago is also physically removable.
    const revoked = crypto.randomUUID();
    await h.query(
      "INSERT INTO authorization_sessions (id,principal_id,identity_id,credential_revision,digest,created_at,idle_expires_at,absolute_expires_at,revoked_at,authenticated_at) VALUES (?,?,?,1,'{}',0,2000000,2000000,990000,0)",
      [revoked, principal, identity],
    );
    expect(await store.purgeExpired(1000000, 1000, 2)).toBe(
      includeLockouts ? 15 : 13,
    );
    expect(await store.purgeExpired(1000000, 1000, 2)).toBe(
      includeLockouts ? 10 : 8,
    );
    expect(await store.purgeExpired(1000000, 1000, 2)).toBe(0);
    for (const table of tables) {
      const rows = await h.query(
        `SELECT count(*) AS n FROM ${table} WHERE ${table === 'account_lockouts' || table === 'rate_limit_counters' ? 'expires_at >= 999500' : 'id = ?'}`,
        table === 'account_lockouts' || table === 'rate_limit_counters'
          ? []
          : [ids[4]!],
      );
      expect(Number(rows[0]!.n)).toBeGreaterThanOrEqual(1);
    }
    expect(
      (
        await h.query('SELECT id FROM authorization_sessions WHERE id = ?', [
          ids[3]!,
        ])
      ).length,
    ).toBe(1);
    await expect(store.purgeExpired(1000000, 1000, 26)).rejects.toThrow();
  });
}
