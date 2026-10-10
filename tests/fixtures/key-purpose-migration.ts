import { expect } from 'vitest';
import { encodeBase64Url } from '../../packages/security/src/crypto.ts';

type Query = (
  sql: string,
  values?: unknown[],
) => Promise<Record<string, unknown>[]>;

const now = 1789800000000;
const recordId = '00000000-0000-4000-8000-000000000210';
const backupId = '00000000-0000-4000-8000-000000000211';
const existing = {
  purpose: 'token-hmac',
  id: 'pre-upgrade',
  version: 1,
};

/** Seed real references before the 0008 key_versions CHECK rebuild. */
export async function seedKeyPurposeUpgrade(query: Query): Promise<void> {
  await query(
    "INSERT INTO key_versions (purpose,key_id,version,state,created_at) VALUES ('token-hmac','pre-upgrade',1,'current',?)",
    [now],
  );
  await query(
    "INSERT INTO protected_records (id,revision,purpose,key_id,key_version,record) VALUES (?,1,'token-hmac','pre-upgrade',1,?)",
    [
      recordId,
      JSON.stringify({
        v: 1,
        alg: 'HS256',
        key: existing,
        digest: encodeBase64Url(new Uint8Array(32).fill(7)),
      }),
    ],
  );
  await query(
    "INSERT INTO key_backups (id,state,retain_until,created_at) VALUES (?,'retained',?,?)",
    [backupId, now + 86400000, now],
  );
  await query(
    "INSERT INTO key_backup_references (backup_id,purpose,key_id,key_version) VALUES (?,'token-hmac','pre-upgrade',1)",
    [backupId],
  );
}

/** Verify retained identity, foreign keys and lifecycle guards after 0008. */
export async function verifyKeyPurposeUpgrade(query: Query): Promise<void> {
  for (const table of [
    'key_versions',
    'protected_records',
    'key_backup_references',
  ]) {
    const rows = await query(`SELECT count(*) AS count FROM ${table}`);
    expect(Number(rows[0]?.count), table).toBe(1);
  }
  await query(
    "INSERT INTO key_versions (purpose,key_id,version,state,created_at) VALUES ('password-pepper','minimum',1,'current',?)",
    [now],
  );
  await expect(
    query(
      "INSERT INTO key_versions (purpose,key_id,version,state,created_at) VALUES ('unknown','invalid',1,'current',?)",
      [now],
    ),
  ).rejects.toThrow();
  await query(
    "UPDATE key_versions SET state='previous' WHERE purpose='token-hmac' AND key_id='pre-upgrade' AND version=1",
  );
  await expect(
    query(
      "UPDATE key_versions SET state='removed' WHERE purpose='token-hmac' AND key_id='pre-upgrade' AND version=1",
    ),
  ).rejects.toThrow();
  await expect(
    query(
      "DELETE FROM key_versions WHERE purpose='token-hmac' AND key_id='pre-upgrade' AND version=1",
    ),
  ).rejects.toThrow();
  const rows = await query(
    "SELECT state FROM key_versions WHERE purpose='token-hmac' AND key_id='pre-upgrade' AND version=1",
  );
  expect(rows[0]?.state).toBe('previous');
}
