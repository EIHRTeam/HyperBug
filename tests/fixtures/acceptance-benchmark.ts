import { writeFile } from 'node:fs/promises';
import { expect } from 'vitest';
import type { SearchIndexStore } from '@hyperbug/application';

/* eslint-disable no-await-in-loop -- Explicitly bounded sequential samples and isolated fixture setup preserve sample attribution. */
/** Opt-in bounded HTTP benchmark, sharing the already authenticated MVP journey. */
export async function measureAcceptance(options: {
  profile: 'node-postgres-local' | 'workerd-d1-local';
  projectId: string;
  issueId: string;
  token: string;
  call(
    path: string,
    init?: {
      method?: string;
      token?: string;
      body?: unknown;
      idempotencyKey?: string;
    },
  ): Promise<{ status: number; json(): Promise<unknown> }>;
  query(sql: string, values: (string | number)[]): Promise<unknown>;
  index: SearchIndexStore;
}) {
  const { projectId, issueId, token, call, query, index, profile } = options;
  for (let n = 2; n <= 1001; n++)
    await query(
      'INSERT INTO issues (id,project_id,number,title,body,body_text,body_text_version,author_id,created_at,updated_at,last_mutation_id) SELECT ?,project_id,?,title,body,body_text,body_text_version,author_id,created_at,updated_at,? FROM issues WHERE id=? AND project_id=?',
      [crypto.randomUUID(), n, crypto.randomUUID(), issueId, projectId],
    );
  await query('UPDATE projects SET next_issue_number=1002 WHERE id=?', [
    projectId,
  ]);
  let cursor: string | null = null;
  for (let page = 0; page < 41; page++) {
    const r = await index.backfill({
      projectId,
      limit: 25,
      ...(cursor ? { after: cursor } : {}),
    });
    cursor = r.nextCursor;
    if (!cursor) break;
  }
  expect(cursor).toBeNull();
  const base = `/api/v1/projects/${projectId}`;
  const samples: Record<string, { status: number; ms: number }[]> = {};
  const cpuStart = process.cpuUsage(),
    memoryBefore = process.memoryUsage();
  async function measure(
    name: string,
    n: number,
    expected: number,
    request: () => ReturnType<typeof call>,
  ) {
    const rows = [];
    for (let i = 0; i < n; i++) {
      const t = performance.now();
      const r = await request();
      await r.json();
      rows.push({ status: r.status, ms: performance.now() - t });
    }
    samples[name] = rows;
    expect(
      rows.map((r) => r.status),
      name,
    ).toEqual(Array(n).fill(expected));
  }
  await measure('list', 20, 200, () =>
    call(`${base}/issues?limit=100`, { token }),
  );
  await measure('detail', 20, 200, () =>
    call(`${base}/issues/${issueId}`, { token }),
  );
  await measure('search', 20, 200, () =>
    call(`${base}/search?q=Crash&limit=20`, { token }),
  );
  await measure('auth-bearer', 20, 200, () =>
    call('/api/v1/account', { token }),
  );
  await measure('password-login-including-hash', 3, 200, () =>
    call('/auth/login', {
      method: 'POST',
      body: { handle: 'rootadmin', password: 'operator-password-1' },
    }),
  );
  await measure('create', 20, 201, () =>
    call(`${base}/issues`, {
      method: 'POST',
      token,
      body: { title: 'Measured creation', body: 'Measured **canonical** body' },
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  await measure('comment', 20, 201, () =>
    call(`${base}/issues/${issueId}/comments`, {
      method: 'POST',
      token,
      body: { body: 'Measured **discussion**' },
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  await measure('upload-intent', 16, 200, () =>
    call(`${base}/uploads/${crypto.randomUUID()}`, {
      method: 'PUT',
      token,
      body: {
        filename: 'abandoned.txt',
        contentType: 'text/plain',
        maxBytes: 7,
        association: { kind: 'issue-draft', draftId: crypto.randomUUID() },
      },
    }),
  );
  await measure('upload-intent-quota-refusal', 4, 409, () =>
    call(`${base}/uploads/${crypto.randomUUID()}`, {
      method: 'PUT',
      token,
      body: {
        filename: 'abandoned.txt',
        contentType: 'text/plain',
        maxBytes: 7,
        association: { kind: 'issue-draft', draftId: crypto.randomUUID() },
      },
    }),
  );
  const percentiles = Object.fromEntries(
    Object.entries(samples).map(([name, rows]) => {
      const times = rows.map((r) => r.ms).sort((a, b) => a - b);
      const p = (q: number) => times[Math.ceil(times.length * q) - 1]!;
      return [
        name,
        {
          samples: rows.length,
          p50Ms: p(0.5),
          p95Ms: p(0.95),
          p99Ms: p(0.99),
          serverErrorRate:
            rows.filter((r) => r.status >= 500).length / rows.length,
        },
      ];
    }),
  );
  const report = {
    recordedAt: new Date().toISOString(),
    profile,
    node: process.version,
    classification:
      profile === 'node-postgres-local'
        ? 'real local PostgreSQL18.6/Node; S3 emulated'
        : 'local workerd/D1/R2 emulation; no paid CPU enforcement',
    fixture: {
      seededIssues: 1001,
      seededFrom:
        'one genuinely authorized form issue; synthetic read-scale copies',
      listLimit: 100,
      concurrency: 1,
      passwordSamples: 3,
      security:
        'real HTTP bearer/current permissions/admission/validation/audit/Markdown; unchanged hash parameters',
    },
    method:
      'nearest rank; response fully consumed; warm sequential loopback; small n, not sustained p99/SLO',
    percentiles,
    samples,
    cpu: {
      scope:
        'Node orchestration process (client plus Node API when same process); excludes workerd/PostgreSQL child CPU; not per-request CPU',
      ...process.cpuUsage(cpuStart),
    },
    memory: {
      scope: 'Node orchestration process, not workerd isolate memory',
      before: memoryBefore,
      after: process.memoryUsage(),
    },
    queryMetrics:
      'reuse separately measured module06/08 query plans/counts/rows; not instrumented here',
    queueLag: 'not measured by synchronous fixture',
    objectOperations:
      'intent reservations perform no object PUT/GET/HEAD/DELETE; sixteen abandoned intents, four expected quota refusals, zero transfer bytes',
  };
  await writeFile(
    `docs/plan/evidence/10-${profile}-http-baseline.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
}
