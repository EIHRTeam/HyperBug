import { describe, expect, it } from 'vitest';
import {
  createAsyncEventHandler,
  createAsyncProcessor,
  createOutboxDispatcher,
  replayFailedTask,
  taskReference,
  type AsyncStore,
  type SearchIndexStore,
  type PluginRegistryStore,
  type PluginSettingsStore,
  type AsyncPluginBinding,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';
import type { PluginManifest } from '@hyperbug/plugin-api';

export function asyncConsumerContract(
  get: () => {
    harness: RepositoryHarness;
    store: AsyncStore;
    search: SearchIndexStore;
    registry: PluginRegistryStore;
    settings: PluginSettingsStore;
  },
) {
  describe('async connected consumers and failure injection', () => {
    const now = 10_000;
    async function seed() {
      const f = get(),
        projectId = nextId(),
        principalId = nextId(),
        id = nextId();
      await f.harness.query(
        'INSERT INTO projects (id,slug,name,created_at,updated_at) VALUES (?,?,?,?,?)',
        [projectId, projectId, 'Async product', now, now],
      );
      await f.harness.query(
        "INSERT INTO principals (id,kind,display_name,created_at) VALUES (?,'user','Async author',?)",
        [principalId, now],
      );
      const intent = {
        id,
        projectId,
        principalId,
        mutationId: nextId(),
        requestId: nextId(),
        now,
        expiresAt: now + 86400000,
        keyHash: '1'.repeat(64),
        payloadHash: '2'.repeat(64),
        title: 'Original queued issue',
        body: 'Canonical content',
        typeId: null,
        milestoneId: null,
        labelIds: [],
        assigneeIds: [],
        auditAction: 'issue.created' as const,
      };
      const handler = createAsyncEventHandler(f);
      return { ...f, intent, handler };
    }
    async function claim(store: AsyncStore, time: number) {
      await store.claim(time, crypto.randomUUID(), 10);
    }
    it('rolls back a failed business commit, survives send-before/send-after failures, and replays after a committed search side effect without reverting newer state', async () => {
      const f = await seed(),
        ref = taskReference('core', f.intent.mutationId);
      // An actual unique conflict at outbox insertion aborts the complete business transaction.
      await f.harness.query(
        "INSERT INTO outbox (id,project_id,aggregate_id,event_type,payload,created_at,available_at) VALUES (?,?,?,'issue.create',?,?,?)",
        [
          ref.eventId,
          f.intent.projectId,
          f.intent.id,
          JSON.stringify({ issueId: f.intent.id, mutationId: ref.eventId }),
          now,
          now,
        ],
      );
      await expect(
        f.harness.repository.createIssue(f.intent),
      ).rejects.toThrow();
      expect(
        await f.harness.query('SELECT id FROM issues WHERE id=?', [
          f.intent.id,
        ]),
      ).toHaveLength(0);
      await f.harness.query('DELETE FROM outbox WHERE id=?', [ref.eventId]);
      await f.harness.repository.createIssue(f.intent);
      let tick = now,
        afterSend = false,
        sent = false;
      const queue = {
        enqueue: async () => {
          if (afterSend) sent = true;
          throw new Error('provider unavailable');
        },
        schedule: async () => {},
      };
      const dispatch = createOutboxDispatcher({
        store: f.store,
        queue,
        clock: () => tick,
      });
      await dispatch();
      expect(sent).toBe(false);
      expect(
        (await f.harness.repository.getIssue(f.intent.projectId, f.intent.id))
          ?.id,
      ).toBe(f.intent.id);
      expect(
        (
          await f.harness.query('SELECT delivered_at FROM outbox WHERE id=?', [
            ref.eventId,
          ])
        )[0]!.delivered_at,
      ).toBeNull();
      tick += 60_001;
      afterSend = true;
      await dispatch();
      expect(sent).toBe(true);
      // Side effect commits, then acknowledgement fails once.
      let loseAck = true,
        crashDuring = true;
      const unreliable = {
        ...f.store,
        complete: async (...args: Parameters<AsyncStore['complete']>) => {
          if (loseAck) {
            loseAck = false;
            throw new Error('crash after side effect');
          }
          return f.store.complete(...args);
        },
      };
      const process = createAsyncProcessor({
        store: unreliable,
        handle: async (event, signal) => {
          if (crashDuring) {
            crashDuring = false;
            throw new Error('crash during processing');
          }
          await f.handler(event, signal);
        },
        clock: () => tick,
      });
      expect(await process(ref)).toBe('ack');
      expect(
        await f.harness.query(
          'SELECT revision FROM search_documents WHERE issue_id=?',
          [f.intent.id],
        ),
      ).toHaveLength(0);
      tick += 2000;
      expect(await process(ref)).toBe('ack');
      expect(
        (
          await f.harness.query(
            'SELECT revision FROM search_documents WHERE issue_id=?',
            [f.intent.id],
          )
        )[0]!.revision,
      ).toBe(1);
      tick += 2000;
      expect(await process(ref)).toBe('ack');
      expect(await process(ref)).toBe('ack');
      const edit = {
        ...f.intent,
        mutationId: nextId(),
        requestId: nextId(),
        keyHash: '3'.repeat(64),
        payloadHash: '4'.repeat(64),
        expectedRevision: 1,
        now: tick,
        title: 'Newer queued title',
        body: 'Latest canonical content',
        auditAction: 'issue.edited' as const,
      };
      await f.harness.repository.editIssue(edit);
      await claim(f.store, tick);
      const updated = taskReference('core', edit.mutationId);
      expect(await process(updated)).toBe('ack');
      await f.handler((await f.store.load(ref))!, new AbortController().signal);
      expect(
        (
          await f.harness.query(
            'SELECT revision,title FROM search_documents WHERE issue_id=?',
            [f.intent.id],
          )
        )[0],
      ).toMatchObject({ revision: 2, title: expect.stringContaining('newer') });
    });
    it('validates persisted poison versions and malformed payloads into visible failures and gates replay', async () => {
      const f = await seed();
      await f.harness.repository.createIssue(f.intent);
      const ref = taskReference('core', f.intent.mutationId);
      await f.harness.query('UPDATE outbox SET event_version=2 WHERE id=?', [
        ref.eventId,
      ]);
      await claim(f.store, now);
      const process = createAsyncProcessor({
        store: f.store,
        handle: f.handler,
        clock: () => now,
      });
      expect(await process(ref)).toBe('ack');
      expect(
        (
          await f.harness.query(
            'SELECT state,failure FROM async_deliveries WHERE event_id=?',
            [ref.eventId],
          )
        )[0],
      ).toMatchObject({ state: 'failed', failure: 'unsupported' });
      await f.harness.query(
        "UPDATE outbox SET event_version=1,payload='{}' WHERE id=?",
        [ref.eventId],
      );
      expect(
        await replayFailedTask({
          store: f.store,
          reference: ref,
          now,
          authorize: async () => true,
        }),
      ).toBe(true);
      expect(await process(ref)).toBe('ack');
      expect(
        (
          await f.harness.query(
            'SELECT state,failure FROM async_deliveries WHERE event_id=?',
            [ref.eventId],
          )
        )[0],
      ).toMatchObject({ state: 'failed', failure: 'invalid' });
    });
    it('dispatches plugin references with fresh configuration/permissions and stable downstream idempotency after lost acknowledgement', async () => {
      const f = await seed();
      const pluginId = `@test/p${nextId().slice(-12)}`,
        eventId = nextId();
      const manifest: PluginManifest = {
        id: pluginId,
        version: '1.0.0',
        apiVersion: '^1.0.0',
        trustTier: 'trusted-native',
        capabilities: ['notifications'],
        extensionPoints: ['notifications:deliver'],
        permissions: ['events:publish'],
        settings: [],
      };
      await f.harness.query(
        "INSERT INTO plugin_registry (id,version,state,manifest,registered_at,updated_at) VALUES (?,?,'enabled',?,?,?)",
        [pluginId, '1.0.0', JSON.stringify(manifest), now, now],
      );
      const envelope = {
        hook: 'notifications:deliver',
        eventId,
        payloadVersion: 1,
        occurredAt: new Date(now).toISOString(),
        pluginId,
        payload: { principalId: f.intent.principalId },
      };
      await f.harness.query(
        'INSERT INTO plugin_event_outbox (event_id,plugin_id,point,payload_version,payload,created_at,available_at) VALUES (?,?,?,?,?,?,?)',
        [
          eventId,
          pluginId,
          envelope.hook,
          1,
          JSON.stringify(envelope),
          now,
          now,
        ],
      );
      const effects = new Set<string>();
      let authorizations = 0;
      const binding: AsyncPluginBinding = {
        id: pluginId,
        version: '1.0.0',
        validateReferences: (e) =>
          Object.keys(e.payload as object).join(',') === 'principalId',
        authorize: async () => {
          authorizations++;
          return (
            (
              await f.harness.query(
                "SELECT id FROM principals WHERE id=? AND status='active'",
                [f.intent.principalId],
              )
            ).length === 1
          );
        },
        run: async (_envelope, context) => {
          context.signal.throwIfAborted();
          effects.add(context.idempotencyKey);
        },
      };
      const handle = createAsyncEventHandler({ ...f, bindings: [binding] });
      const ref = taskReference('plugin', eventId);
      await claim(f.store, now);
      let loseAck = true,
        tick = now;
      const process = createAsyncProcessor({
        store: {
          ...f.store,
          complete: async (...args) => {
            if (loseAck) {
              loseAck = false;
              throw new Error('lost acknowledgement');
            }
            return f.store.complete(...args);
          },
        },
        handle,
        clock: () => tick,
      });
      await process(ref);
      tick += 2000;
      await process(ref);
      await process(ref);
      expect(effects.size).toBe(1);
      expect(authorizations).toBe(2);
      // A separate delayed event sees suspension, never the earlier grant.
      const denied = nextId(),
        deniedRef = taskReference('plugin', denied);
      await f.harness.query(
        'INSERT INTO plugin_event_outbox (event_id,plugin_id,point,payload_version,payload,created_at,available_at) VALUES (?,?,?,?,?,?,?)',
        [
          denied,
          pluginId,
          envelope.hook,
          1,
          JSON.stringify({ ...envelope, eventId: denied }),
          tick,
          tick,
        ],
      );
      await f.harness.query(
        "UPDATE principals SET status='suspended' WHERE id=?",
        [f.intent.principalId],
      );
      await claim(f.store, tick);
      await process(deniedRef);
      expect(effects.size).toBe(1);
      expect(
        (
          await f.harness.query(
            'SELECT failure FROM async_deliveries WHERE event_id=?',
            [denied],
          )
        )[0]!.failure,
      ).toBe('permanent');
    });
  });
}
