import { beforeAll, expect, it } from 'vitest';
import { mkdtemp, cp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import { createD1KeyRegistry } from '@hyperbug/database-d1';
import { activateOperatorKeys } from '../../tooling/operator-registry.ts';
import { migrationStatements } from '../../tooling/migrations.ts';
import { workerModules } from '../fixtures/worker-modules.ts';

beforeAll(() => {
  execFileSync(
    process.execPath,
    ['tooling/build.ts', '--target=cloudflare', '--target=cloudflare-minimum'],
    { stdio: 'pipe' },
  );
});

for (const tier of ['standard', 'minimum'] as const)
  it(`restores the prior ${tier} production Worker artifact against the unchanged migrated D1`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hyperbug-ops-worker-'));
    let mf: Miniflare | undefined;
    try {
      const bundle =
        tier === 'standard' ? 'dist/cloudflare' : 'dist/cloudflare-minimum';
      const prior = join(directory, 'prior');
      await cp(bundle, prior, { recursive: true });
      const entry = tier === 'standard' ? 'index.mjs' : 'minimum.mjs';
      const sha = (value: Uint8Array) =>
        createHash('sha256').update(value).digest('hex');
      expect(sha(await readFile(join(bundle, entry)))).toBe(
        sha(await readFile(join(prior, entry))),
      );
      execFileSync(
        process.execPath,
        ['tooling/provision-operator-files.ts', join(directory, 'keys')],
        { stdio: 'pipe' },
      );
      const ring = await readFile(join(directory, 'keys', 'keys.json'), 'utf8');
      const abuse = await readFile(
        join(directory, 'keys', 'abuse.json'),
        'utf8',
      );
      const name = crypto.randomUUID();
      const evidence = [];
      for (const slot of [bundle, prior]) {
        const modules = workerModules(slot);
        const options = convertV4MiniflareOptions({
          modulesRoot: resolve(slot),
          modules: [
            ...modules.filter((module) => module.path.endsWith('/' + entry)),
            ...modules.filter((module) => !module.path.endsWith('/' + entry)),
          ],
          compatibilityDate: '2026-09-16',
          compatibilityFlags: [
            'nodejs_compat',
            'enable_request_signal',
            'cache_option_enabled',
          ],
          d1Databases: { DB: name },
          resourcePersistencePath: join(directory, 'state'),
          ratelimits: {
            ABUSE_VOLUMETRIC: {
              namespace_id: '130019',
              simple: { limit: 1000, period: 60 },
            },
          },
          bindings: {
            HYPERBUG_ENV: 'local',
            ALLOWED_ORIGINS: 'https://client.example.org',
            HYPERBUG_KEY_RING: ring.trim(),
            HYPERBUG_ABUSE_KEY_RING: abuse.trim(),
            ...(tier === 'minimum'
              ? {
                  HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-minimum',
                  HYPERBUG_DEGRADATION_ACK: 'minimum-v2',
                }
              : {}),
          },
        });
        mf = new Miniflare(options);
        if (slot === bundle) {
          const db = await mf.getD1Database('DB');
          for (const migration of await migrationStatements('d1'))
            await db.batch(migration.statements.map((sql) => db.prepare(sql)));
          await activateOperatorKeys(
            createD1KeyRegistry(db as unknown as D1Database),
            JSON.parse(
              await readFile(
                join(directory, 'keys', 'key-references.json'),
                'utf8',
              ),
            ),
          );
        }
        if (tier === 'minimum')
          await mf.dispatchFetch('https://api.example.org/auth/token/revoke', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              origin: 'https://api.example.org',
            },
            body: '{}',
          });
        expect(
          (await mf.dispatchFetch('https://api.example.org/health/ready'))
            .status,
        ).toBe(200);
        const instance = await mf.dispatchFetch(
          'https://api.example.org/api/v1/instance',
        );
        expect(instance.status).toBe(200);
        const value = (await instance.json()) as { tier: string };
        expect(value.tier).toBe(
          tier === 'minimum' ? 'cloudflare-minimum' : 'standard',
        );
        evidence.push({
          slot: slot === bundle ? 'candidate' : 'restored-prior',
          ready: 200,
          instance: 200,
        });
        await mf.dispose();
        mf = undefined;
      }
      await mkdir('docs/plan/evidence', { recursive: true });
      await writeFile(
        `docs/plan/evidence/13-worker-rollback-${tier}.json`,
        JSON.stringify(
          {
            v: 1,
            tier,
            scope:
              'native local workerd/D1; health and metadata compatibility only',
            sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
              encoding: 'utf8',
            }).trim(),
            priorArtifact:
              'captured compatible artifact slot; no changed-app-version claim',
            entrySha256: sha(await readFile(join(prior, entry))),
            sameSchema: true,
            evidence,
            cleanup: 'owned runtimes/private files/state removed in finally',
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      await mf?.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  }, 30000);
