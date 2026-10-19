import { it, expect } from 'vitest';
import { Pool } from 'pg';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  readdir,
  copyFile,
  mkdir,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { migrationStatements } from '../../tooling/migrations.ts';
import { migratePostgres } from '../../tooling/migrate-postgres.ts';
import { activateOperatorKeys } from '../../tooling/operator-registry.ts';
import {
  createD1Repository,
  createD1KeyRegistry,
  createD1UploadIntentStore,
  createD1ContentDefinitionStore,
} from '@hyperbug/database-d1';
import {
  createPostgresRepository,
  createPostgresKeyRegistry,
  createPostgresUploadIntentStore,
  createPostgresContentDefinitionStore,
} from '@hyperbug/database-postgres';
import {
  SecretKeyProvider,
  encryptSecret,
  decryptSecret,
  type KeyRegistry,
  type KeyReference,
} from '../../packages/security/src/index.ts';
import {
  validateIssueFormAnswers,
  attachmentScanPolicyVersion,
  type IssueRepository,
  type UploadIntentStore,
  type ContentDefinitionStore,
} from '@hyperbug/application';
import {
  seedFormSubmissionFixture,
  formUploadQuota,
} from '../fixtures/form-submission-contract.ts';
import { syntheticClean } from '../fixtures/upload-scan-contract.ts';
import {
  seedPreviousSchema,
  verifyRejectedUpgrade,
} from '../fixtures/migration-contract.ts';
import { blobKey, blobTestPolicy } from '../fixtures/blob-store-proof.ts';
import { startLocalS3 } from '../../tooling/local-s3.ts';
import { createS3BlobStore } from '@hyperbug/blob-s3';
import { startSeaweedTestService } from '../../tooling/seaweed-test-service.ts';

const hash = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');
const pgBin = process.env.PG_BIN ?? '/opt/homebrew/opt/postgresql@18/bin';
const uuid = () => crypto.randomUUID();

// A composed recovery exercise, never a production repair or scanner acceptance.
it('rehearses coordinated database/blob/config/key recovery and compatible artifact rollback', async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error('Use disposable PostgreSQL wrapper');
  const directory = await mkdtemp(join(tmpdir(), 'hyperbug-ops13-'));
  const rootPool = new Pool({ max: 1 });
  const reports: Record<string, unknown>[] = [];
  let seaweed: Awaited<ReturnType<typeof startSeaweedTestService>> | undefined;
  let localS3: Awaited<ReturnType<typeof startLocalS3>> | undefined;
  const binary = process.env.HYPERBUG_TEST_SEAWEED;
  try {
    // Real S3 is explicitly required in the release rehearsal; ordinary CI retains emulation.
    if (binary) seaweed = await startSeaweedTestService(binary);
    else localS3 = await startLocalS3();
    const storage = seaweed ?? localS3!;
    for (const profile of ['postgres', 'd1'] as const) {
      const started = performance.now();
      const name = 'ops_' + uuid().replaceAll('-', '');
      let pool: Pool | undefined;
      let mf: Miniflare | undefined;
      const persist = join(directory, profile);
      let db: D1Database;
      const startD1 = () =>
        new Miniflare(
          convertV4MiniflareOptions({
            modules: true,
            script:
              'export default { fetch() { return new Response("offline fixture"); } }',
            compatibilityDate: '2026-09-16',
            d1Databases: { DB: name },
            resourcePersistencePath: persist,
          }),
        );
      const adapter = createS3BlobStore({
        ...storage,
        multipart: blobTestPolicy,
      });
      const objectKeys: string[] = [];
      try {
        let query: (
          sql: string,
          values?: (string | number)[],
        ) => Promise<Record<string, unknown>[]>;
        let apply: (sql: string[]) => Promise<void>;
        let repository: IssueRepository;
        let registry: KeyRegistry;
        let uploads: UploadIntentStore;
        let definitions: ContentDefinitionStore;
        const migrations = await migrationStatements(profile);
        if (profile === 'postgres') {
          await rootPool.query(`CREATE DATABASE ${name}`);
          pool = new Pool({ database: name });
          query = async (sql, values = []) => {
            let i = 0;
            return (
              await pool!.query(
                sql.replace(/\?/g, () => `$${++i}`),
                values,
              )
            ).rows;
          };
          apply = async (sql) => {
            const client = await pool!.connect();
            try {
              await client.query('BEGIN');
              for (const statement of sql) await client.query(statement);
              await client.query('COMMIT');
            } catch (error) {
              await client.query('ROLLBACK');
              throw error;
            } finally {
              client.release();
            }
          };
          repository = createPostgresRepository(pool);
          registry = createPostgresKeyRegistry(pool);
          uploads = createPostgresUploadIntentStore(pool, formUploadQuota);
          definitions = createPostgresContentDefinitionStore(pool);
        } else {
          mf = startD1();
          db = (await mf.getD1Database('DB')) as unknown as D1Database;
          query = async (sql, values = []) =>
            (
              await db
                .prepare(sql)
                .bind(...values)
                .all<Record<string, unknown>>()
            ).results;
          apply = async (sql) => {
            await db.batch(sql.map((statement) => db.prepare(statement)));
          };
          repository = createD1Repository(db);
          registry = createD1KeyRegistry(db);
          uploads = createD1UploadIntentStore(db, formUploadQuota);
          definitions = createD1ContentDefinitionStore(db);
        }
        const harness = { query, repository };
        await apply(migrations[0]!.statements);
        const verifyOld = await verifyRejectedUpgrade(harness, () =>
          apply(migrations[1]!.statements),
        );
        for (const migration of migrations.slice(2))
          await apply(migration.statements);
        await verifyOld();
        const before = await query(
          'SELECT id,title,body,revision FROM issues ORDER BY id',
        );
        // Recorded 0000 writer still works after the complete forward history.
        const verifyRolling = await seedPreviousSchema(harness);
        await verifyRolling();
        const priorSchemaRead = await query(
          'SELECT id,title,body,revision FROM issues ORDER BY id',
        );
        expect(priorSchemaRead.length).toBeGreaterThan(before.length);
        const references: KeyReference[] = [
          'token-hmac',
          'blind-index',
          'envelope-kek',
          'password-pepper',
        ].map((purpose) => ({
          purpose: purpose as KeyReference['purpose'],
          id: 'operator-v1',
          version: 1,
        }));
        execFileSync(
          process.execPath,
          [
            'tooling/provision-operator-files.ts',
            join(directory, profile + '-keys'),
          ],
          { stdio: 'pipe' },
        );
        const keyFile = join(directory, profile + '-keys', 'keys.json');
        const keys = JSON.parse(await readFile(keyFile, 'utf8')) as {
          keys: { ref: KeyReference; material: string }[];
        };
        expect(keys.keys.map((key) => key.ref)).toEqual(references);
        await activateOperatorKeys(registry, references);
        await expect(
          activateOperatorKeys(registry, references),
        ).rejects.toThrow('already initialized');
        const source = { read: async () => readFile(keyFile, 'utf8') };
        const provider = new SecretKeyProvider(source, registry);
        const context = {
          resourceType: 'operator-fixture',
          resourceId: uuid(),
          field: 'secret',
          projectId: null,
          schemaVersion: 1,
        };
        const secret = await encryptSecret(
          provider,
          new Uint8Array([7, 8, 9]),
          context,
        );
        const mutate = async (
          change: Parameters<KeyRegistry['mutate']>[0]['change'],
        ) =>
          registry.mutate({
            expectedGeneration: (
              await registry.inspect(AbortSignal.timeout(5000))
            ).generation,
            auditId: uuid(),
            requestId: uuid(),
            now: Date.now(),
            change,
          });
        await mutate({
          kind: 'put',
          id: context.resourceId,
          expectedRevision: 0,
          record: secret,
        });
        const form = await seedFormSubmissionFixture(harness, definitions);
        const at = 1791000000000;
        const bytes = new TextEncoder().encode('abc');
        const input = {
          id: uuid(),
          projectId: form.projectId,
          principalId: form.principalId,
          stagingKey: blobKey(),
          finalKey: blobKey('objects'),
          filename: 'restore.txt',
          contentType: 'text/plain',
          maxBytes: 4,
          now: at,
          expiresAt: at + 60000,
          association: { kind: 'issue-draft' as const, draftId: uuid() },
        };
        objectKeys.push(input.finalKey);
        await adapter.store.put({
          key: input.finalKey,
          body: new Blob([bytes]).stream(),
          size: 3,
          contentType: 'text/plain',
          createOnly: true,
        });
        await uploads.reserve(input);
        await uploads.requestFinalize(input, at);
        const token = { ...input, leaseId: uuid(), leaseExpiresAt: at + 1000 };
        await uploads.claim(token);
        await uploads.commitVerified({
          ...token,
          verified: {
            key: input.finalKey,
            size: 3,
            sha256: hash(bytes),
            contentType: 'text/plain',
            providerVersion: null,
            scanStatus: 'unscanned',
          },
        });
        const scan = { ...token, leaseId: uuid() };
        await uploads.mutateScan({
          ...scan,
          kind: 'claim',
          policyVersion: attachmentScanPolicyVersion,
        });
        await uploads.mutateScan({
          ...scan,
          kind: 'commit',
          outcome: syntheticClean,
        });
        await uploads.mutateScan({
          ...scan,
          kind: 'release',
          policyVersion: attachmentScanPolicyVersion,
          attemptId: scan.leaseId,
        });
        const values = { details: 'Canonical **answers**', files: [input.id] };
        const issue = await repository.createIssue({
          ...form.intent(),
          body: validateIssueFormAnswers(form.definition, values).markdown,
          formSubmission: {
            formId: form.formId,
            formVersion: 1,
            values,
            draftId: input.association.draftId,
          },
        });
        expect(
          (
            await query('SELECT * FROM attachments WHERE upload_intent_id=?', [
              input.id,
            ])
          ).length,
        ).toBe(1);
        const backupId = uuid();
        await mutate({
          kind: 'begin-backup',
          id: backupId,
          retainUntil: Date.now() + 86400000,
        });
        const config = await readFile('deploy/node/public-policy.example.json');
        await writeFile(join(directory, profile + '-policy.json'), config, {
          mode: 0o600,
        });
        await copyFile(keyFile, join(directory, profile + '-key-backup.json'));
        const original = await adapter.store.get(input.finalKey);
        const backupBytes = new Uint8Array(
          await new Response(original!.body).arrayBuffer(),
        );
        await writeFile(join(directory, profile + '-blob'), backupBytes, {
          mode: 0o600,
        });
        await mutate({ kind: 'finish-backup', id: backupId });
        const tables =
          profile === 'postgres'
            ? (
                await query(
                  "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
                )
              ).map((r) => String(r.name))
            : (
                await query(
                  "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
                )
              ).map((r) => String(r.name));
        const snapshots = new Map<string, string[]>();
        for (const table of tables)
          snapshots.set(
            table,
            (await query(`SELECT * FROM "${table}"`))
              .map((r) => JSON.stringify(r))
              .sort(),
          );
        const archive = join(directory, profile + '-database');
        if (profile === 'postgres')
          execFileSync(
            join(pgBin, 'pg_dump'),
            ['--format=custom', '--file=' + archive, name],
            { stdio: 'pipe' },
          );
        else {
          await mf!.dispose();
          mf = undefined;
          const sqlite = (await readdir(persist, { recursive: true })).find(
            (file) => file.endsWith('.sqlite'),
          );
          if (!sqlite) throw new Error('Missing owned local D1 SQLite file');
          execFileSync(
            '/usr/bin/sqlite3',
            [join(persist, sqlite), `.backup '${archive}'`],
            { stdio: 'pipe' },
          );
          mf = startD1();
          db = (await mf.getD1Database('DB')) as unknown as D1Database;
        }
        const capturedAt = Date.now();
        if (profile === 'd1') registry = createD1KeyRegistry(db!);
        await mutate({ kind: 'revoke', key: references[2]! });
        await writeFile(
          join(directory, profile + '-revocations.json'),
          JSON.stringify([references[2]!]),
          { mode: 0o600 },
        );
        await query('UPDATE issues SET title=? WHERE id=?', [
          'post-capture write',
          issue.result.id,
        ]);
        await adapter.store.delete(input.finalKey);
        const restoreStarted = performance.now();
        if (profile === 'postgres') {
          await pool!.end();
          await rootPool.query(`DROP DATABASE ${name}`);
          await rootPool.query(`CREATE DATABASE ${name}`);
          execFileSync(
            join(pgBin, 'pg_restore'),
            [
              '--exit-on-error',
              '--no-owner',
              '--no-privileges',
              '--dbname=' + name,
              archive,
            ],
            { stdio: 'pipe' },
          );
          pool = new Pool({ database: name });
          registry = createPostgresKeyRegistry(pool);
          repository = createPostgresRepository(pool);
        } else {
          await mf!.dispose();
          mf = undefined;
          const sqlite = (await readdir(persist, { recursive: true })).find(
            (file) => file.endsWith('.sqlite'),
          )!;
          // The runtime is stopped. Retiring stale WAL/SHM is part of an owned
          // physical snapshot restore; otherwise newer committed pages can win.
          await rm(join(persist, sqlite) + '-wal', { force: true });
          await rm(join(persist, sqlite) + '-shm', { force: true });
          await copyFile(archive, join(persist, sqlite));
          mf = startD1();
          db = (await mf.getD1Database('DB')) as unknown as D1Database;
          registry = createD1KeyRegistry(db);
          repository = createD1Repository(db);
        }
        const restoredBytes = await readFile(
          join(directory, profile + '-blob'),
        );
        await adapter.store.put({
          key: input.finalKey,
          body: new Blob([restoredBytes]).stream(),
          size: restoredBytes.length,
          contentType: 'text/plain',
          createOnly: true,
        });
        await copyFile(join(directory, profile + '-key-backup.json'), keyFile);
        for (const [table, rows] of snapshots)
          expect(
            (await query(`SELECT * FROM "${table}"`))
              .map((r) => JSON.stringify(r))
              .sort(),
            table,
          ).toEqual(rows);
        expect(
          hash(await readFile(join(directory, profile + '-policy.json'))),
        ).toBe(hash(config));
        const restoredProvider = new SecretKeyProvider(source, registry);
        expect(
          Array.from(
            await decryptSecret(
              restoredProvider,
              (await registry.getRecord(
                context.resourceId,
                AbortSignal.timeout(5000),
              ))!.record,
              context,
            ),
          ),
        ).toEqual([7, 8, 9]);
        const attachment = (
          await query(
            'SELECT object_key,checksum,size_bytes FROM attachments WHERE upload_intent_id=?',
            [input.id],
          )
        )[0]!;
        const restoredObject = await adapter.store.get(
          String(attachment.object_key),
        );
        expect(
          hash(
            new Uint8Array(
              await new Response(restoredObject!.body).arrayBuffer(),
            ),
          ),
        ).toBe(attachment.checksum);
        expect(Number(attachment.size_bytes)).toBe(3);
        expect(
          (await repository.getIssue(form.projectId, issue.result.id))!.title,
        ).not.toBe('post-capture write');
        if (profile === 'd1')
          expect(await query('PRAGMA foreign_key_check')).toEqual([]);
        else
          expect(
            (
              await query(
                'SELECT count(*) AS count FROM pg_constraint WHERE NOT convalidated',
              )
            )[0]!.count,
          ).toBe('0');
        const restoredAt = Date.now();
        const restoreMs = performance.now() - restoreStarted;
        const revocations: KeyReference[] = JSON.parse(
          await readFile(
            join(directory, profile + '-revocations.json'),
            'utf8',
          ),
        );
        for (const key of revocations) await mutate({ kind: 'revoke', key });
        await expect(
          decryptSecret(restoredProvider, secret, context),
        ).rejects.toThrow();
        await expect(
          mutate({ kind: 'remove', key: references[2]! }),
        ).rejects.toThrow();
        // Read-only operator queries are real SQL; diagnostics contain only costs.
        const operatorCosts = [];
        const operatorSql = (
          await readFile('deploy/operator-queries.sql', 'utf8')
        )
          .replace(/^--.*$/gm, '')
          .split(';')
          .map((text) => text.trim())
          .filter(Boolean);
        for (const [index, sql] of operatorSql.entries()) {
          const began = performance.now();
          if (profile === 'd1') {
            const result = await db!.prepare(sql).all();
            operatorCosts.push({
              index,
              elapsedMs: performance.now() - began,
              rowsReturned: result.results.length,
              rowsRead: result.meta.rows_read,
              rowsWritten: result.meta.rows_written,
            });
          } else {
            const rows = await query(sql);
            const explain = await query(
              'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + sql,
            );
            operatorCosts.push({
              index,
              elapsedMs: performance.now() - began,
              rowsReturned: rows.length,
              explain: explain[0]?.['QUERY PLAN'],
            });
          }
        }
        reports.push({
          profile,
          operatorCosts,
          storage: seaweed?.version ?? 'local S3 emulation',
          migrations: migrations.length,
          priorSchema: '0000_foundation',
          oldWriter: 'frozen 0000 fixture',
          tables: tables.length,
          rows: [...snapshots.values()].reduce((n, rows) => n + rows.length, 0),
          backupBytes: (await readFile(archive)).length,
          blobBytes: 3,
          blobDigest: hash(bytes),
          scan: 'synthetic clean fixture; no engine claim',
          capturedAt,
          restoredAt,
          restoreMs,
          totalMs: performance.now() - started,
          dataLoss:
            'one deliberate post-capture title update; no captured rows lost',
          encryptedRead: true,
          backupPinsPreserved: true,
          revocationDenial: true,
          postCaptureRevocationReconciled: true,
        });
      } finally {
        for (const key of objectKeys)
          await adapter.store.delete(key).catch(() => {});
        adapter.close();
        await mf?.dispose();
        await pool?.end();
        if (profile === 'postgres')
          await rootPool.query(`DROP DATABASE IF EXISTS ${name}`);
      }
    }
    // The actual production Node root receives TERM, drains Graphile/pool and exits.
    const freshName = 'ops_fresh_' + uuid().replaceAll('-', '');
    await rootPool.query(`CREATE DATABASE ${freshName}`);
    const fresh = new Pool({ database: freshName });
    try {
      expect((await migratePostgres(fresh, true)).applied.length).toBe(
        (await migrationStatements('postgres')).length,
      );
      expect((await migratePostgres(fresh, true)).applied).toEqual([]);
      const keyDir = join(directory, 'node-root');
      execFileSync(
        process.execPath,
        ['tooling/provision-operator-files.ts', keyDir],
        { stdio: 'pipe' },
      );
      await activateOperatorKeys(
        createPostgresKeyRegistry(fresh),
        JSON.parse(await readFile(join(keyDir, 'key-references.json'), 'utf8')),
      );
      const prior = join(directory, 'prior-node');
      await mkdir(prior);
      // Snapshot the last accepted backend build before the documentation-only candidate.
      execFileSync(process.execPath, ['tooling/build.ts', '--target=node'], {
        stdio: 'pipe',
      });
      const artifact = resolve('dist/node/index.mjs');
      const saved = join(prior, 'index.mjs');
      await copyFile(artifact, saved);
      const code = await readFile(saved);
      expect(hash(code)).toBe(hash(await readFile(artifact)));
      // Preserve node_modules resolution for the isolated slot without copying dependencies.
      const { symlink } = await import('node:fs/promises');
      await symlink(
        resolve('node_modules'),
        join(directory, 'node_modules'),
        'dir',
      );
      const lifecycle = [];
      for (const entry of [artifact, saved]) {
        const child = spawn(process.execPath, [entry], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            HYPERBUG_ENV: 'local',
            ALLOWED_ORIGINS: 'http://localhost:5173',
            HYPERBUG_DATABASE_SOCKET_DIR: process.env.PGHOST!,
            HYPERBUG_DATABASE_NAME: freshName,
            HYPERBUG_DATABASE_USER: process.env.PGUSER!,
            HYPERBUG_KEY_FILE: join(keyDir, 'keys.json'),
            HYPERBUG_ABUSE_KEY_FILE: join(keyDir, 'abuse.json'),
            PORT: '30987',
            HOST: '127.0.0.1',
          },
        });
        let ready = false;
        let elapsed = 0;
        try {
          for (let i = 0; i < 50; i++) {
            if (child.exitCode !== null)
              throw new Error('Production root exited before readiness');
            try {
              const r = await fetch('http://127.0.0.1:30987/health/ready');
              if (r.status === 200) {
                ready = true;
                break;
              }
            } catch {}
            await new Promise((r) => setTimeout(r, 100));
          }
          expect(ready).toBe(true);
          const stop = performance.now();
          const exit = once(child, 'exit');
          child.kill('SIGTERM');
          const status = await Promise.race([
            exit,
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Production shutdown deadline')),
                10000,
              ).unref(),
            ),
          ]);
          elapsed = performance.now() - stop;
          expect(status[0]).toBe(0);
          lifecycle.push({
            slot: entry === artifact ? 'candidate' : 'restored-prior',
            ready,
            shutdownMs: elapsed,
            exitCode: status[0],
          });
        } finally {
          if (child.exitCode === null) {
            const stopped = once(child, 'exit');
            child.kill('SIGKILL');
            await stopped;
          }
        }
      }
      reports.push({
        profile: 'node-artifact-rollback',
        sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
          encoding: 'utf8',
        }).trim(),
        priorArtifact:
          'captured compatible artifact slot; no changed-app-version claim',
        artifactSha256: hash(code),
        sameSchema: true,
        lifecycle,
      });
    } finally {
      await fresh.end();
      await rootPool.query(`DROP DATABASE ${freshName}`);
    }
    await mkdir('docs/plan/evidence', { recursive: true });
    await writeFile(
      'docs/plan/evidence/13-maintenance-measurements.json',
      JSON.stringify(
        {
          v: 1,
          recordedAt: new Date().toISOString(),
          scope: 'disposable local only',
          reports,
          cleanup:
            'owned databases, blobs, processes, private files and services removed in finally',
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await rootPool.end();
    await seaweed?.close();
    await localS3?.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 120000);
