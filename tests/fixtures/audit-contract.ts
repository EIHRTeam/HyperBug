import { beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import {
  auditEvent,
  createAuditService,
  decodeBase64Url,
  encodeBase64Url,
  type AuditRepository,
  type AuditEvent,
} from '../../packages/security/src/index.ts';
import { auditFacts, auditNow, auditPolicy } from './audit-scenarios.ts';

export interface AuditHarness {
  repository: AuditRepository;
  query(
    sql: string,
    values?: (string | number)[],
  ): Promise<Record<string, unknown>[]>;
}
const signal = () => new AbortController().signal;
const id = () => crypto.randomUUID();
async function seed(harness: AuditHarness) {
  const projectId = id(),
    otherProjectId = id(),
    actorId = id();
  for (const project of [projectId, otherProjectId])
    await harness.query(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [project, `audit-${project}`, 'Audit project', auditNow, auditNow],
    );
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Audit administrator', ?)",
    [actorId, auditNow],
  );
  return { projectId, otherProjectId, actorId };
}
function event(
  projectId: string,
  actorId: string,
  overrides: Partial<AuditEvent> = {},
) {
  return auditEvent({
    id: id(),
    projectId,
    actorId,
    systemActor: null,
    action: 'issue.created',
    targetId: id(),
    result: 'success',
    requestId: id(),
    createdAt: auditNow,
    metadata: {},
    ...overrides,
  });
}
function service(repository: AuditRepository) {
  return createAuditService({
    repository,
    authorization: { resolve: async (request) => auditFacts(request) },
    policy: { ...auditPolicy, timeoutMs: 1000 },
    now: () => auditNow,
    timeoutMs: 5000,
  });
}
export function auditRepositoryContract(get: () => AuditHarness) {
  describe('shared audit persistence and service contract', () => {
    let projectId: string, otherProjectId: string, actorId: string;
    beforeEach(async () => {
      ({ projectId, otherProjectId, actorId } = await seed(get()));
    });
    it('appends exactly once under concurrent duplicate IDs and rejects update/delete', async () => {
      const { repository, query } = get();
      const e = event(projectId, actorId);
      const results = await Promise.allSettled([
        repository.append(e, signal()),
        repository.append(e, signal()),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        Number(
          (
            await query(
              'SELECT count(*) AS count FROM audit_events WHERE id = ?',
              [e.id],
            )
          )[0]?.count,
        ),
      ).toBe(1);
      await expect(
        query('UPDATE audit_events SET action = ? WHERE id = ?', [
          'tampered',
          e.id,
        ]),
      ).rejects.toThrow();
      await expect(
        query('DELETE FROM audit_events WHERE id = ?', [e.id]),
      ).rejects.toThrow();
      expect(
        await repository.list({ projectId, limit: 1, before: null }, signal()),
      ).toEqual([e]);
    });
    it('traverses equal timestamps with stable cursors and no global/cross-project rows', async () => {
      const { repository } = get();
      const rows = [
        event(projectId, actorId),
        event(projectId, actorId),
        event(projectId, actorId),
      ];
      for (const row of rows) await repository.append(row, signal());
      await repository.append(event(otherProjectId, actorId), signal());
      await repository.append(
        event(projectId, actorId, {
          projectId: null,
          actorId: null,
          systemActor: 'core.key-registry',
          action: 'key-registry.put',
          metadata: { v: 1, generation: 1 },
        }),
        signal(),
      );
      const reader = service(repository);
      const first = await reader.read(
        { actorId, projectId, limit: 2 },
        signal(),
      );
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      const second = await reader.read(
        { actorId, projectId, limit: 2, after: first.nextCursor! },
        signal(),
      );
      expect(second.nextCursor).toBeNull();
      expect([...first.items, ...second.items].map((r) => r.id)).toEqual(
        rows
          .map((r) => r.id)
          .sort()
          .reverse(),
      );
      await expect(
        reader.read(
          { actorId, projectId: otherProjectId, after: first.nextCursor! },
          signal(),
        ),
      ).rejects.toMatchObject({ code: 'AUDIT_INVALID' });
      const cursor = JSON.parse(
        new TextDecoder().decode(decodeBase64Url(first.nextCursor, 1, 768)),
      );
      for (const changes of [
        { resource: 'issues' },
        { sort: 'ascending' },
        { v: 2 },
        { extra: true },
        { before: null },
        { before: { createdAt: 1, id: "' OR 1=1" } },
      ]) {
        const after = encodeBase64Url(
          new TextEncoder().encode(JSON.stringify({ ...cursor, ...changes })),
        );
        await expect(
          reader.read({ actorId, projectId, after }, signal()),
        ).rejects.toMatchObject({ code: 'AUDIT_INVALID' });
      }
      // A newer append appears on refresh, never within continuation of the old page.
      const newer = event(projectId, actorId, { createdAt: auditNow + 1 });
      await repository.append(newer, signal());
      expect(
        (
          await reader.read(
            { actorId, projectId, after: first.nextCursor! },
            signal(),
          )
        ).items.map((r) => r.id),
      ).not.toContain(newer.id);
      expect(
        (await reader.read({ actorId, projectId }, signal())).items[0]?.id,
      ).toBe(newer.id);
    });
    it('persists only safe audit decisions and denies access when required append fails', async () => {
      const { repository, query } = get();
      const reader = service(repository);
      const requestId = id();
      expect(
        await reader.check(
          {
            actorId,
            permission: 'project:configure',
            target: { projectId, type: 'project', id: projectId },
          },
          requestId,
          signal(),
        ),
      ).toEqual({ allowed: true });
      const records = await repository.list(
        { projectId, limit: 10, before: null },
        signal(),
      );
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        requestId,
        action: 'authorization.checked',
        result: 'success',
        metadata: { decision: 'allowed', permission: 'project:configure' },
      });
      const failing = service({
        ...repository,
        append: async () => {
          throw new Error('SEEDED_SECRET');
        },
      });
      expect(
        await failing.check(
          {
            actorId,
            permission: 'project:configure',
            target: { projectId, type: 'project', id: projectId },
          },
          id(),
          signal(),
        ),
      ).toEqual({ allowed: false, reason: 'unavailable' });
      for (const invalid of [
        { metadata: { password: 'SEEDED_SECRET' } },
        { targetId: 'SEEDED_SECRET' },
        { systemActor: 'core.key-registry' },
      ])
        await expect(
          repository.append(
            { ...event(projectId, actorId), ...invalid } as AuditEvent,
            signal(),
          ),
        ).rejects.toThrow();
      expect(
        JSON.stringify(
          await query('SELECT * FROM audit_events WHERE project_id = ?', [
            projectId,
          ]),
        ),
      ).not.toContain('SEEDED_SECRET');
    });
    it('denies corrupted stored metadata instead of returning secret-bearing rows', async () => {
      const { repository, query } = get();
      const e = event(projectId, actorId);
      await query(
        'INSERT INTO audit_events (id, project_id, actor_id, action, target_id, result, request_id, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          e.id,
          projectId,
          actorId,
          e.action,
          e.targetId,
          e.result,
          e.requestId,
          e.createdAt,
          JSON.stringify({ password: 'SEEDED_SECRET' }),
        ],
      );
      await expect(
        service(repository).read({ actorId, projectId }, signal()),
      ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
    });
    it('rejects malformed bounds and pre-cancelled operations without a partial append', async () => {
      const { repository, query } = get();
      const cancelled = new AbortController();
      cancelled.abort();
      await expect(
        repository.append(event(projectId, actorId), cancelled.signal),
      ).rejects.toThrow();
      await expect(
        repository.list(
          { projectId, limit: 1, before: null },
          cancelled.signal,
        ),
      ).rejects.toThrow();
      for (const limit of [0, -1, 101, NaN, Infinity])
        await expect(
          repository.list({ projectId, limit, before: null }, signal()),
        ).rejects.toThrow();
      expect(
        Number(
          (
            await query(
              'SELECT count(*) AS count FROM audit_events WHERE project_id = ?',
              [projectId],
            )
          )[0]?.count,
        ),
      ).toBe(0);
    });
  });
}

export async function measureAuditQueries(
  harness: AuditHarness,
  dialect: 'd1' | 'postgres',
) {
  const { projectId, actorId } = await seed(harness);
  // D1 caps one statement at 100 bound parameters; 10 rows of 9 values stay at 90.
  const rows = 10;
  const batches = 4000 / rows;
  for (let batch = 0; batch < batches; batch++) {
    const values: (string | number)[] = [];
    for (let i = 0; i < rows; i++)
      values.push(
        id(),
        projectId,
        actorId,
        'issue.created',
        id(),
        'success',
        id(),
        auditNow + batch * rows + i,
        '{}',
      );
    await harness.query(
      `INSERT INTO audit_events (id, project_id, actor_id, action, target_id, result, request_id, created_at, metadata) VALUES ${Array.from({ length: rows }, () => '(?,?,?,?,?,?,?,?,?)').join(',')}`,
      values,
    );
  }
  const reader = service(harness.repository);
  let after: string | undefined;
  let lastPage;
  const started = performance.now();
  for (let page = 0; page < 39; page++) {
    lastPage = await reader.read(
      { actorId, projectId, limit: 100, ...(after ? { after } : {}) },
      signal(),
    );
    expect(lastPage.items).toHaveLength(100);
    after = lastPage.nextCursor ?? undefined;
  }
  const boundary = lastPage!.items.at(-1)!;
  // Explain the exact projection the adapter's list query uses, not a narrower
  // surrogate, so the plan proves the served query stays on the index.
  const statement =
    dialect === 'd1'
      ? 'SELECT id, project_id AS projectId, actor_id AS actorId, system_actor AS systemActor, action, target_id AS targetId, result, request_id AS requestId, created_at AS createdAt, metadata FROM audit_events WHERE project_id = ? AND (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT ?'
      : 'SELECT id, project_id AS "projectId", actor_id AS "actorId", system_actor AS "systemActor", action, target_id AS "targetId", result, request_id AS "requestId", created_at AS "createdAt", metadata FROM audit_events WHERE project_id = ? AND (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT ?';
  const plan = await harness.query(
    (dialect === 'd1'
      ? 'EXPLAIN QUERY PLAN '
      : 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ') + statement,
    [projectId, boundary.createdAt, boundary.id, 101],
  );
  const serialized = JSON.stringify(plan);
  expect(serialized).toContain('audit_project_order');
  if (dialect === 'd1') expect(serialized).not.toContain('USE TEMP B-TREE');
  else {
    expect(serialized).not.toContain('Seq Scan');
    expect(serialized).not.toContain('Rows Removed by Filter');
  }
  await writeFile(
    `docs/plan/evidence/03-${dialect}-audit-query.json`,
    JSON.stringify(
      {
        kind: 'local indexed project-audit traversal; not deployed or plan-tier acceptance',
        dialect,
        events: 4000,
        pages: 39,
        pageSize: 100,
        traversalWallMs: performance.now() - started,
        plan,
      },
      null,
      2,
    ) + '\n',
  );
}
