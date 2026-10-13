import { expect } from 'vitest';
import type { IssueContext } from '../../packages/server/src/issues.ts';
import { listIssues } from '../../packages/server/src/issues.ts';
import {
  createDbAuthorizationResolver,
  authorizationPolicy,
} from '../../packages/server/src/authorization-facts.ts';
import { tokenContext } from '../../packages/server/src/oauth.ts';
import {
  digestCredential,
  generateOpaqueCredential,
} from '../../packages/security/src/index.ts';
import { cryptoFixture } from './crypto-scenarios.ts';

export async function readPathContract(
  query: (
    sql: string,
    values?: (string | number)[],
  ) => Promise<Record<string, unknown>[]>,
  stores: Pick<
    IssueContext,
    'administration' | 'roleStore' | 'projects' | 'issues' | 'tokenStore'
  >,
  measure: <T>(
    run: () => Promise<T>,
  ) => Promise<{ value: T; statements: string[] }>,
) {
  const principalId = crypto.randomUUID(),
    identityId = crypto.randomUUID(),
    projectId = crypto.randomUUID(),
    now = Date.now();
  await query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Reader', ?)",
    [principalId, now],
  );
  await query(
    "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES (?, ?, 'local-password', 'hyperbug', 'read_path_staff', ?)",
    [identityId, principalId, now],
  );
  const record = {
    v: 1,
    alg: 'Argon2id',
    memoryKiB: 19456,
    passes: 2,
    parallelism: 1,
    salt: 'AQEBAQEBAQEBAQEBAQEBAQ',
    verifier: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
  };
  await query(
    'INSERT INTO password_credentials (identity_id, record, revision, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
    [identityId, JSON.stringify(record), now, now],
  );
  await query(
    "INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, 'read-path', 'Read Path', ?, ?)",
    [projectId, now, now],
  );
  await query(
    "INSERT INTO project_roles (project_id, principal_id, role, granted_at) VALUES (?, ?, 'maintainer', ?)",
    [projectId, principalId, now],
  );
  for (const [i, moderation] of ['visible', 'hidden'].entries())
    await query(
      'INSERT INTO issues (id, project_id, number, author_id, created_at, updated_at, last_mutation_id, body, title, moderation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        projectId,
        i + 1,
        principalId,
        now,
        now,
        crypto.randomUUID(),
        'Fixture body',
        'Fixture ' + moderation,
        moderation,
      ],
    );
  const provider = cryptoFixture().provider,
    tokenId = crypto.randomUUID(),
    secret = generateOpaqueCredential();
  await stores.tokenStore!.insertAccessToken({
    id: tokenId,
    digest: JSON.stringify(
      await digestCredential(provider, secret, tokenContext(tokenId)),
    ),
    principalId,
    identityId,
    clientId: 'read-path',
    scope: 'public-api',
    nowMs: now,
    expiresAtMs: now + 600_000,
    authMethod: 'passkey',
    authenticatedAtMs: now,
    assurance: 2,
  });
  const resolver = createDbAuthorizationResolver({
    loadPrincipal: (id) => stores.administration!.loadPrincipal(id),
    loadInstanceRole: (id) => stores.administration!.loadInstanceRole(id),
    loadProject: (id) => stores.administration!.loadProject(id),
    loadMembership: (project, actor) =>
      stores.roleStore!.loadRole(project, actor),
  });
  const context: IssueContext = {
    ...stores,
    keyProvider: provider,
    authorizationResolver: resolver,
    authorizationPolicy,
    taxonomy: null,
    admission: null,
    contentDefinitions: null,
  };
  const request = (authenticated = true) =>
    new Request('https://api.fixture/issues', {
      headers: authenticated
        ? { authorization: `Bearer at_${tokenId}.${secret}` }
        : {},
    });
  const oldContext = {
    ...context,
    authorizationResolver: { resolve: resolver.resolve.bind(resolver) },
  };
  const baselineAnonymous = await measure(() =>
    listIssues(request(false), oldContext, projectId, {}),
  );
  const baselineStaff = await measure(() =>
    listIssues(request(), oldContext, projectId, {}),
  );
  const anonymous = await measure(() =>
    listIssues(request(false), context, projectId, {}),
  );
  const staff = await measure(() =>
    listIssues(request(), context, projectId, {}),
  );
  expect(baselineAnonymous.statements).toHaveLength(5);
  expect(anonymous.statements).toHaveLength(4);
  expect(baselineStaff.statements).toHaveLength(11);
  expect(staff.statements).toHaveLength(7);
  expect(anonymous.value.items).toHaveLength(1);
  expect(staff.value.items).toHaveLength(2);
  expect(
    staff.statements.filter((sql) => sql.includes('credential_active')),
  ).toHaveLength(1);
  expect(
    staff.statements.filter((sql) =>
      sql.includes('SELECT role FROM project_roles'),
    ),
  ).toHaveLength(1);
  await query(
    'DELETE FROM project_roles WHERE project_id = ? AND principal_id = ?',
    [projectId, principalId],
  );
  expect(
    (await listIssues(request(), context, projectId, {})).items,
  ).toHaveLength(1);
  await query("UPDATE principals SET status = 'suspended' WHERE id = ?", [
    principalId,
  ]);
  await expect(
    listIssues(request(), context, projectId, {}),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await query("UPDATE principals SET status = 'active' WHERE id = ?", [
    principalId,
  ]);
  await query("UPDATE projects SET visibility = 'private' WHERE id = ?", [
    projectId,
  ]);
  await expect(
    listIssues(request(), context, projectId, {}),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  return {
    anonymousBefore: 5,
    anonymousAfter: 4,
    staffBefore: 11,
    staffAfter: 7,
  };
}
