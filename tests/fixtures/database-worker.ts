import {
  keyRegistryRuntimeProof,
  minimumPasswordRegistryProof,
} from './key-registry-runtime.ts';
import type {
  RegistryMutation,
  KeyPurpose,
} from '../../packages/security/src/index.ts';
import type { D1Database } from '@cloudflare/workers-types';
import { createD1Repository, createD1KeyRegistry } from '@hyperbug/database-d1';
import { createD1RateCounterStore } from '@hyperbug/database-d1';
import { createD1AccountLockoutStore } from '@hyperbug/database-d1';
import type { AccountLockoutPolicy } from '../../packages/security/src/account-lockout.ts';
import type {
  RateCounterWrite,
  RateSubject,
} from '../../packages/security/src/rate-limit.ts';
import { abuseSubjectDigest } from '../../packages/security/src/rate-limit.ts';
import { DomainError } from '@hyperbug/domain';
import type {
  CreateIssueIntent,
  EditIssueIntent,
  IssueListQuery,
} from '@hyperbug/application';

type Message =
  | { method: 'rateDigestProof' }
  | { method: 'registryRuntimeProof' }
  | { method: 'minimumPasswordRegistryProof' }
  | { method: 'registryInspect' }
  | { method: 'registryLoad'; input: KeyPurpose }
  | { method: 'registryMutate'; input: RegistryMutation }
  | { method: 'registryGet'; input: string }
  | { method: 'createIssue'; input: CreateIssueIntent }
  | { method: 'editIssue'; input: EditIssueIntent }
  | { method: 'getIssue'; input: { projectId: string; id: string } }
  | { method: 'listIssues'; input: IssueListQuery }
  | { method: 'rateIncrement'; input: RateCounterWrite }
  | { method: 'ratePurge'; input: { nowMs: number; limit: number } }
  | { method: 'lockoutGet'; input: { subject: RateSubject; nowMs: number } }
  | {
      method: 'lockoutFailure';
      input: {
        subject: RateSubject;
        nowMs: number;
        policy: AccountLockoutPolicy;
      };
    }
  | { method: 'lockoutClear'; input: RateSubject }
  | { method: 'lockoutPurge'; input: { nowMs: number; limit: number } };

// Internal loopback test transport. Never included in production entry points.
export default {
  async fetch(request: Request, env: { DB: D1Database }): Promise<Response> {
    const queries: string[] = [];
    const measured = {
      prepare(sql: string) {
        queries.push(sql);
        return env.DB.prepare(sql);
      },
      batch: env.DB.batch.bind(env.DB),
      withSession(mode: 'first-primary') {
        const session = env.DB.withSession(mode);
        return {
          prepare(sql: string) {
            queries.push(sql);
            return session.prepare(sql);
          },
          batch: session.batch.bind(session),
        };
      },
    };
    const repository = createD1Repository(measured as unknown as D1Database);
    const registry = createD1KeyRegistry(measured as unknown as D1Database);
    const rateCounters = createD1RateCounterStore(
      measured as unknown as D1Database,
    );
    const lockouts = createD1AccountLockoutStore(
      measured as unknown as D1Database,
    );
    const signal = request.signal;
    const message = (await request.json()) as Message;
    try {
      let value: unknown;
      switch (message.method) {
        case 'rateDigestProof': {
          const key = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(32).fill(7),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
          );
          value = await abuseSubjectDigest(
            key,
            1,
            'login',
            'account',
            'person@example.org',
          );
          break;
        }
        case 'registryRuntimeProof':
          value = await keyRegistryRuntimeProof(registry);
          break;
        case 'minimumPasswordRegistryProof':
          value = await minimumPasswordRegistryProof(registry);
          break;
        case 'registryInspect':
          value = await registry.inspect(signal);
          break;
        case 'registryLoad':
          value = await registry.load(message.input, signal);
          break;
        case 'registryMutate':
          value = await registry.mutate(message.input);
          break;
        case 'registryGet':
          value = await registry.getRecord(message.input, signal);
          break;
        case 'createIssue':
          value = await repository.createIssue(message.input);
          break;
        case 'editIssue':
          value = await repository.editIssue(message.input);
          break;
        case 'getIssue':
          value = await repository.getIssue(
            message.input.projectId,
            message.input.id,
          );
          break;
        case 'listIssues':
          value = await repository.listIssues(message.input);
          break;
        case 'rateIncrement':
          value = await rateCounters.increment(message.input);
          break;
        case 'ratePurge':
          value = await rateCounters.purgeExpired(
            message.input.nowMs,
            message.input.limit,
          );
          break;
        case 'lockoutGet':
          value = await lockouts.get(
            message.input.subject,
            message.input.nowMs,
          );
          break;
        case 'lockoutFailure':
          value = await lockouts.recordFailure(
            message.input.subject,
            message.input.nowMs,
            message.input.policy,
          );
          break;
        case 'lockoutClear':
          value = await lockouts.clear(message.input);
          break;
        case 'lockoutPurge':
          value = await lockouts.purgeExpired(
            message.input.nowMs,
            message.input.limit,
          );
          break;
        default:
          return new Response(null, { status: 400 });
      }
      return Response.json({ value, queries });
    } catch (error) {
      return Response.json(
        {
          error: {
            code:
              error instanceof DomainError ? error.code : 'PERSISTENCE_FAILURE',
          },
          queries,
        },
        { status: 500 },
      );
    }
  },
};
