import { expect } from 'vitest';
import {
  digestCredential,
  generateOpaqueCredential,
  type KeyProvider,
} from '../../packages/security/src/index.ts';
import { tokenContext } from '../../packages/server/src/oauth.ts';

/** A verified high-assurance Staff token still cannot derive instance powers from its own project. */
export async function instanceEscalationContract(
  query: (sql: string, values?: (string | number)[]) => Promise<unknown>,
  call: (
    path: string,
    init?: { method?: string; token?: string; body?: unknown },
  ) => Promise<{
    status: number;
    json(): Promise<unknown>;
    clone(): { text(): Promise<string> };
  }>,
  provider: KeyProvider,
) {
  const principal = crypto.randomUUID(),
    identity = crypto.randomUUID(),
    id = crypto.randomUUID();
  const now = Date.now(),
    secret = generateOpaqueCredential();
  const digest = JSON.stringify(
    await digestCredential(provider, secret, tokenContext(id)),
  );
  await query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Project creator', ?)",
    [principal, now],
  );
  await query(
    "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES (?, ?, 'local-password', 'hyperbug', ?, ?)",
    [identity, principal, identity, now],
  );
  await query(
    "INSERT INTO password_credentials (identity_id, record, revision, created_at, updated_at) VALUES (?, '{}', 1, ?, ?)",
    [identity, now, now],
  );
  await query(
    "INSERT INTO oauth_access_tokens (id, digest, principal_id, identity_id, client_id, scope, created_at, expires_at, auth_method, authenticated_at, assurance) VALUES (?, ?, ?, ?, 'fixture', 'public-api', ?, ?, 'passkey', ?, 2)",
    [id, digest, principal, identity, now, now + 600000, now],
  );
  const token = `at_${id}.${secret}`;
  const project = await call('/api/v1/projects', {
    method: 'POST',
    token,
    body: { slug: `creator-${principal}`, name: 'Creator project' },
  });
  expect(project.status, await project.clone().text()).toBe(201);
  for (const [path, method, body] of [
    [`/api/v1/admin/principals/${principal}/suspend`, 'POST', {}],
    [`/api/v1/admin/principals/${principal}/activate`, 'POST', {}],
    ['/api/v1/admin/plugins', 'GET', undefined],
  ] as const) {
    const denied = await call(path, {
      token,
      method,
      ...(body === undefined ? {} : { body }),
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  }
}
