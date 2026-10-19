import { countD1Calls } from '../fixtures/d1-call-count.ts';
import { expect, it, vi } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import { migrationStatements } from '../fixtures/migrations.ts';
import {
  createD1Repository,
  createD1MinimumAsyncStore,
  createD1PluginRegistryStore,
  createD1PluginSettingsStore,
} from '@hyperbug/database-d1';
import {
  createAsyncProcessor,
  createAsyncEventHandler,
} from '@hyperbug/application';

async function fixture() {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        {
          type: 'ESModule',
          path: 'empty.mjs',
          contents: 'export default {fetch(){return new Response("ok")}}',
        },
      ],
      compatibilityDate: '2026-09-16',
      d1Databases: { DB: 'minimum-search-admission' },
    }),
  );
  const db = (await mf.getD1Database('DB')) as unknown as D1Database;
  for (const migration of await migrationStatements('d1'))
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
  const project = crypto.randomUUID(),
    author = crypto.randomUUID(),
    issue = crypto.randomUUID(),
    event = crypto.randomUUID(),
    now = Date.now();
  await db.batch([
    db
      .prepare(
        'INSERT INTO projects(id,slug,name,created_at,updated_at) VALUES (?,?,?,?,?)',
      )
      .bind(project, project, 'Admission', now, now),
    db
      .prepare(
        "INSERT INTO principals(id,kind,display_name,created_at) VALUES (?,'user','Admission',?)",
      )
      .bind(author, now),
  ]);
  await createD1Repository(db).createIssue({
    id: issue,
    projectId: project,
    principalId: author,
    mutationId: event,
    requestId: crypto.randomUUID(),
    now,
    expiresAt: now + 86400000,
    keyHash: '1'.repeat(64),
    payloadHash: '2'.repeat(64),
    title: 'Admission',
    body: 'Canonical body',
    typeId: null,
    milestoneId: null,
    labelIds: [],
    assigneeIds: [],
    auditAction: 'issue.created',
  });
  return { mf, db, project, issue, event, now };
}
const processor = (
  minimum: ReturnType<typeof createD1MinimumAsyncStore>,
  db: D1Database,
  token: string,
  now: number,
) =>
  createAsyncProcessor({
    store: minimum.executionStore(),
    token: () => token,
    clock: () => now,
    handle: createAsyncEventHandler({
      search: minimum.searchStore(),
      registry: createD1PluginRegistryStore(db),
      settings: createD1PluginSettingsStore(db),
      tier: 'cloudflare-minimum',
    }),
  });

it('Minimum canonical indexing uses three provider calls and charges search only once', async () => {
  const f = await fixture();
  try {
    const counted = countD1Calls(f.db),
      minimum = createD1MinimumAsyncStore(counted.db);
    const admission = await minimum.admitAndClaim(f.now, 'canonical');
    const budget = (await f.db.prepare('SELECT * FROM search_budget').all())
      .results;
    expect(budget[0]).toMatchObject({ reads: 2000, writes: 520 });
    expect(
      await processor(
        minimum,
        counted.db,
        'canonical',
        f.now,
      )(admission.references[0]),
    ).toBe('ack');
    expect(counted.calls()).toBe(3);
    expect(counted.statements()).toBe(10);
    expect(
      (await f.db.prepare('SELECT * FROM search_budget').all()).results,
    ).toEqual(budget);
    expect(
      await f.db
        .prepare(
          'SELECT revision,body,projection_version FROM search_documents WHERE issue_id=?',
        )
        .bind(f.issue)
        .first(),
    ).toEqual({
      revision: 1,
      body: '',
      projection_version: expect.stringMatching(/^title-v1:/),
    });
    await f.db
      .prepare(
        'UPDATE async_minimum_budget SET reads=1500000,writes=30000 WHERE id=1',
      )
      .run();
    expect(
      await createD1MinimumAsyncStore(f.db).admitAndClaim(
        f.now + 1,
        'canonical',
      ),
    ).toEqual({ admitted: false, references: [] });
    expect(
      (await f.db.prepare('SELECT * FROM search_budget').all()).results,
    ).toEqual(budget);
  } finally {
    await f.mf.dispose();
  }
}, 25000);

it('Minimum initializes missing cursors and wraps an empty prefix to discover an older pending source', async () => {
  const f = await fixture();
  try {
    const first = createD1MinimumAsyncStore(f.db),
      admitted = await first.admitAndClaim(f.now, 'first');
    await processor(first, f.db, 'first', f.now)(admitted.references[0]);
    const older = crypto.randomUUID();
    await f.db
      .prepare(
        "INSERT INTO outbox(id,project_id,aggregate_id,event_type,payload,created_at,available_at) VALUES (?,?,?,'comment.create','{}',?,?)",
      )
      .bind(older, f.project, f.issue, f.now - 1, f.now - 1)
      .run();
    // No source follows the previous cursor: this tick resets both prefixes.
    expect(
      (await createD1MinimumAsyncStore(f.db).admitAndClaim(f.now + 1, 'wrap'))
        .references,
    ).toEqual([]);
    expect(
      (
        await f.db
          .prepare(
            'SELECT source,available_at,event_id FROM async_minimum_cursors ORDER BY source',
          )
          .all()
      ).results,
    ).toEqual([
      { source: 'core', available_at: 0, event_id: '' },
      { source: 'plugin', available_at: 0, event_id: '' },
    ]);
    const next = createD1MinimumAsyncStore(f.db),
      recovered = await next.admitAndClaim(f.now + 2, 'older');
    expect(recovered.references[0]?.eventId).toBe(older);
    await processor(next, f.db, 'older', f.now + 2)(recovered.references[0]);
    expect(
      await f.db
        .prepare('SELECT delivered_at FROM outbox WHERE id=?')
        .bind(older)
        .first(),
    ).toEqual({ delivered_at: f.now + 2 });
  } finally {
    await f.mf.dispose();
  }
}, 25000);

it('Minimum retains search quota failures, recovers after reset and keeps poison/alternate JSON on the ordinary validator path', async () => {
  const f = await fixture();
  try {
    const day = Math.floor(Date.now() / 86400000);
    await f.db
      .prepare(
        'INSERT INTO search_budget(id,day,reads,writes) VALUES (1,?,1000000,20000)',
      )
      .bind(day)
      .run();
    let minimum = createD1MinimumAsyncStore(f.db),
      admission = await minimum.admitAndClaim(f.now, 'exhausted');
    await processor(minimum, f.db, 'exhausted', f.now)(admission.references[0]);
    expect(
      await f.db
        .prepare('SELECT delivered_at FROM outbox WHERE id=?')
        .bind(f.event)
        .first(),
    ).toEqual({ delivered_at: null });
    expect(
      await f.db
        .prepare('SELECT state,failure FROM async_deliveries WHERE event_id=?')
        .bind(f.event)
        .first(),
    ).toEqual({ state: 'pending', failure: 'transient' });
    await f.db
      .prepare('UPDATE search_budget SET day=? WHERE id=1')
      .bind(day - 1)
      .run();
    minimum = createD1MinimumAsyncStore(f.db);
    admission = await minimum.admitAndClaim(f.now + 30001, 'recovered');
    await processor(
      minimum,
      f.db,
      'recovered',
      f.now + 30001,
    )(admission.references[0]);
    expect(
      await f.db
        .prepare('SELECT delivered_at FROM outbox WHERE id=?')
        .bind(f.event)
        .first(),
    ).toEqual({ delivered_at: f.now + 30001 });
    for (const [index, payload, version] of [
      [
        0,
        JSON.stringify({ issueId: f.issue, mutationId: f.event, extra: true }),
        1,
      ],
      [1, JSON.stringify({ issueId: f.issue, mutationId: f.event }), 2],
      [
        2,
        `{"issueId":"${f.issue}","mutationId":"${crypto.randomUUID()}","mutationId":"${f.event}"}`,
        1,
      ],
    ] as const) {
      const id = crypto.randomUUID(),
        time = f.now + 40000 + index;
      await f.db
        .prepare(
          "INSERT INTO outbox(id,project_id,aggregate_id,event_type,event_version,payload,created_at,available_at) VALUES (?,?,?,'issue.edit',?,?,?,?)",
        )
        .bind(id, f.project, f.issue, version, payload, time, time)
        .run();
      const before = (
        await f.db.prepare('SELECT day,reads,writes FROM search_budget').all()
      ).results;
      minimum = createD1MinimumAsyncStore(f.db);
      admission = await minimum.admitAndClaim(time, 'alternate-' + index);
      expect(
        (await f.db.prepare('SELECT day,reads,writes FROM search_budget').all())
          .results,
      ).toEqual(before);
      expect(
        await processor(
          minimum,
          f.db,
          'alternate-' + index,
          time,
        )(admission.references[0]),
      ).toBe('ack');
      const state = await f.db
        .prepare('SELECT state,failure FROM async_deliveries WHERE event_id=?')
        .bind(id)
        .first();
      expect(state).toEqual(
        index === 2
          ? { state: 'done', failure: null }
          : {
              state: 'failed',
              failure: index === 0 ? 'invalid' : 'unsupported',
            },
      );
      if (index < 2)
        expect(
          (
            await f.db
              .prepare('SELECT day,reads,writes FROM search_budget')
              .all()
          ).results,
        ).toEqual(before);
    }
  } finally {
    await f.mf.dispose();
  }
}, 25000);

it('Minimum rechecks current projection/visibility and does not reuse a prior-day admission', async () => {
  const f = await fixture();
  const originalNow = Date.now(),
    clock = vi.spyOn(Date, 'now').mockReturnValue(originalNow);
  try {
    const minimum = createD1MinimumAsyncStore(f.db),
      admission = await minimum.admitAndClaim(f.now, 'changed');
    await f.db
      .prepare(
        "UPDATE issues SET moderation='hidden',body_text_version='changed-projection' WHERE id=?",
      )
      .bind(f.issue)
      .run();
    await processor(minimum, f.db, 'changed', f.now)(admission.references[0]);
    expect(
      (
        await f.db
          .prepare('SELECT * FROM search_documents WHERE issue_id=?')
          .bind(f.issue)
          .all()
      ).results,
    ).toHaveLength(0);
    const id = crypto.randomUUID(),
      time = f.now + 1;
    await f.db
      .prepare(
        "INSERT INTO outbox(id,project_id,aggregate_id,event_type,payload,created_at,available_at) VALUES (?,?,?,'issue.edit',?,?,?)",
      )
      .bind(
        id,
        f.project,
        f.issue,
        JSON.stringify({ issueId: f.issue, mutationId: f.event }),
        time,
        time,
      )
      .run();
    const next = createD1MinimumAsyncStore(f.db),
      claim = await next.admitAndClaim(time, 'day-change');
    clock.mockReturnValue(originalNow + 86400000);
    await processor(next, f.db, 'day-change', time)(claim.references[0]);
    expect(
      await f.db.prepare('SELECT day,reads,writes FROM search_budget').first(),
    ).toEqual({
      day: Math.floor((originalNow + 86400000) / 86400000),
      reads: 2000,
      writes: 520,
    });
    expect(
      await f.db
        .prepare('SELECT active,body FROM search_documents WHERE issue_id=?')
        .bind(f.issue)
        .first(),
    ).toEqual({ active: 0, body: '' });
  } finally {
    clock.mockRestore();
    await f.mf.dispose();
  }
}, 25000);
