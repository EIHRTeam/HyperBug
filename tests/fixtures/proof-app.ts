import {
  createApp,
  createBoundSensitiveActionAdmission,
  requireAuthorizedAction,
  withDeadline,
  RequestFailure,
  type AppOptions,
} from '@hyperbug/server';
import { EchoSchema, type Echo } from '@hyperbug/contracts';
import { Elysia, t } from 'elysia';
import { securityScenarios } from './security-scenarios.ts';
import {
  cryptoScenarios,
  cryptoKnownAnswers,
  minimumPasswordScenarios,
} from './crypto-scenarios.ts';
import { abuseKeyFixture } from './abuse-key-fixture.ts';
import { SecretAbuseKeyProvider } from '../../packages/security/src/abuse-keys.ts';
import { validVolumetricKey } from '../../packages/security/src/rate-limit.ts';
import type {
  AuthorizationFacts,
  PermissionRequest,
} from '../../packages/security/src/authorization.ts';
import type {
  RateCounterStore,
  RateCounterWrite,
} from '../../packages/security/src/rate-limit.ts';

export function createProofApp(
  options: AppOptions,
  clientAddress: (request: Request) => string = () => '192.0.2.42',
) {
  let cancellationCount = 0;
  let requestAbortCount = 0;
  let startedCount = 0;
  let readiness = 'healthy';
  let admittedActions = 0;
  let authorizedActions = 0;
  let admissionWrites = 0;
  let registrationHashes = 0;
  let registrationCreates = 0;
  const registeredHandles = new Set<string>();
  const admissionCounts = new Map<string, number>();
  const abuseKeys = new SecretAbuseKeyProvider({
    read: async () => abuseKeyFixture(),
  });
  const admissionStore: RateCounterStore = {
    async increment(input: RateCounterWrite) {
      admissionWrites++;
      const id = JSON.stringify([
        input.category,
        input.dimension,
        input.keyVersion,
        input.digest,
        input.windowStart,
      ]);
      const count = (admissionCounts.get(id) ?? 0) + 1;
      admissionCounts.set(id, count);
      return count;
    },
    async purgeExpired() {
      return 0;
    },
  };
  const admissionLimiter = {
    async consume(digest: string, nowMs: number) {
      return validVolumetricKey(digest, nowMs)
        ? ({ allowed: true } as const)
        : ({ allowed: false, reason: 'unavailable' } as const);
    },
  };
  const admissionRule = { limit: 2, windowMs: 60000, retentionMs: 86400000 };
  const admissionChecks = [
    {
      dimension: 'account' as const,
      canonicalSubject: 'known-fixture@example.org',
      rule: admissionRule,
    },
    {
      dimension: 'ip' as const,
      rule: admissionRule,
    },
  ];
  const authorizationNow = 1800000000000;
  const actorId = '00000000-0000-4000-8000-000000000001';
  const projectId = '00000000-0000-4000-8000-000000000002';
  const permissionRequest: PermissionRequest = {
    actorId,
    permission: 'project:configure',
    target: { projectId, type: 'project', id: projectId },
  };
  const permissionFacts: AuthorizationFacts = {
    binding: permissionRequest,
    instanceRole: null,
    principal: {
      id: actorId,
      kind: 'staff',
      status: 'active',
      credentialActive: true,
      expiresAtMs: authorizationNow + 60000,
      authenticatedAtMs: authorizationNow - 1000,
      assurance: 2,
    },
    project: { id: projectId, visibility: 'private', state: 'active' },
    membership: {
      principalId: actorId,
      projectId,
      active: true,
      role: 'administrator',
    },
    resource: {
      ref: permissionRequest.target,
      deleted: false,
      publicReadable: false,
      permissionGranted: true,
    },
  };
  return createApp({
    ...options,
    standardPassword:
      options.standardPassword === undefined
        ? {
            async hash() {
              registrationHashes++;
              return {
                v: 1 as const,
                alg: 'Argon2id' as const,
                memoryKiB: 19456,
                passes: 2,
                parallelism: 1,
                salt: 'AAAAAAAAAAAAAAAAAAAAAA',
                verifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
              };
            },
            async verify() {
              return { verified: false, replacement: null };
            },
          }
        : options.standardPassword,
    registrationStore:
      options.registrationStore === undefined
        ? {
            async register(input) {
              if (registeredHandles.has(input.handle))
                return { status: 'existing' as const };
              registeredHandles.add(input.handle);
              registrationCreates++;
              return {
                status: 'created' as const,
                principalId: input.principalId,
              };
            },
          }
        : options.registrationStore,
    abuse: {
      provider: abuseKeys,
      store: admissionStore,
      limiter: admissionLimiter,
      clientAddress,
    },
    ready: async (signal) => {
      if (readiness === 'unavailable') return false;
      if (readiness === 'error')
        throw new Error('private dependency credentials must not leak');
      if (readiness === 'timeout')
        return new Promise<boolean>((resolve) =>
          signal.addEventListener('abort', () => resolve(false), {
            once: true,
          }),
        );
      return options.ready(signal);
    },
  })
    .get('/_proof/registration/state', () => ({
      hashes: registrationHashes,
      creates: registrationCreates,
    }))
    .get('/_proof/authorization', () => securityScenarios())
    .get('/_proof/authorization-admission/state', () => ({
      actions: authorizedActions,
    }))
    .get(
      '/_proof/authorization-admission/:mode',
      async ({ params, request }) => {
        const mode = params.mode;
        if (
          !['allow', 'forbidden', 'reauth', 'outage', 'timeout'].includes(mode)
        )
          throw new RequestFailure('INVALID_REQUEST');
        await requireAuthorizedAction({
          request: permissionRequest,
          resolver: {
            resolve: async () => {
              if (mode === 'outage')
                throw new Error('private authorization provider detail');
              if (mode === 'timeout')
                return new Promise<AuthorizationFacts>(() => {});
              if (mode === 'forbidden')
                return {
                  ...permissionFacts,
                  resource: {
                    ...permissionFacts.resource,
                    permissionGranted: false,
                  },
                };
              if (mode === 'reauth')
                return {
                  ...permissionFacts,
                  principal: {
                    ...permissionFacts.principal!,
                    authenticatedAtMs: authorizationNow - 300001,
                  },
                };
              return permissionFacts;
            },
          },
          policy: { recentAuthMaxAgeMs: 300000, timeoutMs: 20 },
          signal: request.signal,
          now: () => authorizationNow,
        });
        authorizedActions++;
        return { completed: true };
      },
    )
    .get('/_proof/crypto', async () => ({
      vectors: await cryptoKnownAnswers(),
      scenarios: await cryptoScenarios(),
    }))
    .get('/_proof/minimum-password', () => minimumPasswordScenarios())
    .get('/_proof/captcha', ({ captcha, captchaSiteKey }) => ({
      enabled: captcha.enabled,
      siteKey: captchaSiteKey,
    }))
    .get('/_proof/key-provider', async ({ keyProvider }) => {
      const key = await keyProvider.current('token-hmac');
      return { purpose: key.ref.purpose };
    })
    .get(
      '/_proof/minimum-login-admission',
      ({ request, minimumLoginAdmission }) =>
        minimumLoginAdmission.require({
          request,
          checks: [],
          nowMs: 2000000000000,
          signal: request.signal,
        }),
    )
    .post('/_proof/input', () => ({ accepted: true }))
    .get('/_proof/safe-failure', () => {
      const failure = new RequestFailure('FORBIDDEN');
      failure.message =
        'SEEDED_SECRET /private/path SELECT password FROM credentials';
      throw failure;
    })
    .get('/_proof/rate-limited', () => {
      throw new RequestFailure('RATE_LIMITED', 37);
    })
    .get('/_proof/rate-unavailable', () => {
      throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
    })
    .get('/_proof/sensitive-admission/state', () => ({
      actions: admittedActions,
      writes: admissionWrites,
    }))
    .get(
      '/_proof/sensitive-admission/:mode',
      async ({ params, request, sensitiveAdmission, captcha }) => {
        const mode = params.mode;
        if (
          ![
            'normal',
            'key-outage',
            'store-outage',
            'key-stall',
            'store-stall',
            'volume-limit',
            'volume-outage',
            'invalid',
            'invalid-timeout',
          ].includes(mode)
        )
          throw new RequestFailure('INVALID_REQUEST');
        const provider =
          mode === 'key-stall'
            ? { active: async () => new Promise<never>(() => undefined) }
            : mode === 'key-outage'
              ? {
                  active: async () => {
                    throw new Error('private abuse-key source failure');
                  },
                }
              : abuseKeys;
        const store =
          mode === 'store-stall'
            ? {
                increment: async () => new Promise<never>(() => undefined),
                purgeExpired: async () => 0,
              }
            : mode === 'store-outage'
              ? {
                  increment: async () => {
                    throw new Error('private counter failure');
                  },
                  purgeExpired: async () => 0,
                }
              : admissionStore;
        const guard =
          mode === 'normal'
            ? sensitiveAdmission
            : createBoundSensitiveActionAdmission(captcha, {
                provider,
                store,
                limiter:
                  mode === 'volume-limit'
                    ? {
                        consume: async () =>
                          ({ allowed: false, reason: 'limited' }) as const,
                      }
                    : mode === 'volume-outage'
                      ? {
                          consume: async () => {
                            throw new Error(
                              'private volumetric provider failure',
                            );
                          },
                        }
                      : admissionLimiter,
                clientAddress,
              });
        await guard.require({
          request,
          category: 'login',
          checks:
            mode === 'invalid' ? admissionChecks.slice(0, 1) : admissionChecks,
          nowMs: 2000000000000,
          signal: request.signal,
          timeoutMs:
            mode === 'invalid-timeout'
              ? 0
              : mode.endsWith('-stall')
                ? 50
                : 1000,
          captchaAction: 'login',
        });
        admittedActions++;
        return { completed: true };
      },
    )
    .get(
      '/_proof/cache-override',
      () =>
        new Response('private', {
          headers: { 'cache-control': 'public, max-age=3600' },
        }),
    )
    .get('/_proof/cache-set-override', ({ set }) => {
      set.headers['cache-control'] = 'public, max-age=3600';
      return { private: true };
    })
    .get('/_proof/cache-immutable', () =>
      Response.redirect('https://example.com/', 302),
    )
    .get(
      '/_proof/boundary-override',
      () =>
        new Response('private', {
          headers: {
            'access-control-allow-origin': 'https://evil.test',
            'access-control-allow-credentials': 'true',
            vary: 'Accept',
            'x-request-id': 'attacker',
            'x-content-type-options': 'unsafe',
            'cache-control': 'public, max-age=3600',
          },
        }),
    )
    .get('/_proof/boundary-set-override', ({ set }) => {
      set.headers = {
        'Access-Control-Allow-Origin': 'https://evil.test',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Accept',
        'X-Request-Id': 'attacker',
        'X-Content-Type-Options': 'unsafe',
        'Cache-Control': 'public, max-age=3600',
      };
      return { private: true };
    })
    .get('/_proof/boundary-error-override', ({ set }) => {
      set.headers['access-control-allow-origin'] = 'https://evil.test';
      set.headers['access-control-allow-credentials'] = 'true';
      set.headers['x-request-id'] = 'attacker';
      throw new RequestFailure('FORBIDDEN');
    })
    .get('/_proof/readiness/:mode', ({ params }) => {
      readiness = params.mode;
      return { ok: true };
    })
    .post('/_proof/echo', ({ body }) => body, {
      body: t.Unsafe<Echo>(EchoSchema),
      response: t.Unsafe<Echo>(EchoSchema),
    })
    .get('/_proof/cancellations', () => ({
      count: cancellationCount,
      requestAborts: requestAbortCount,
      started: startedCount,
    }))
    .get('/_proof/cancel', ({ request }) => {
      startedCount += 1;
      let finished = false;
      let timer: ReturnType<typeof setTimeout>;
      let heartbeat: ReturnType<typeof setInterval>;
      const onAbort = () => {
        requestAbortCount += 1;
        cancel();
      };
      const cancel = () => {
        if (!finished) {
          finished = true;
          cancellationCount += 1;
          clearTimeout(timer);
          clearInterval(heartbeat);
          request.signal.removeEventListener('abort', onAbort);
        }
      };
      return new Response(
        new ReadableStream({
          start(controller) {
            request.signal.addEventListener('abort', onAbort, { once: true });
            controller.enqueue(new TextEncoder().encode('ready\n'));
            // workerd detects a closed peer when it next writes to the socket.
            heartbeat = setInterval(() => {
              controller.enqueue(new TextEncoder().encode('ping\n'));
            }, 50);
            timer = setTimeout(() => {
              if (!finished) {
                finished = true;
                clearInterval(heartbeat);
                request.signal.removeEventListener('abort', onAbort);
                controller.close();
              }
            }, 3000);
          },
          cancel,
        }),
        {
          headers: {
            'content-type': 'text/plain',
            'cache-control': 'no-store, no-transform',
          },
        },
      );
    })
    .get('/_proof/error', () => {
      throw new Error(
        'provider-password=DO_NOT_LEAK /private/path database sql',
      );
    })
    .get('/_proof/timeout', ({ request }) =>
      withDeadline(
        request.signal,
        50,
        (signal) =>
          new Promise((resolve) => {
            signal.addEventListener('abort', () => resolve('cancelled'), {
              once: true,
            });
          }),
      ),
    )
    .get(
      '/_proof/stream',
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('first\n'));
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode('second\n'));
                controller.close();
              }, 250);
            },
          }),
          { headers: { 'content-type': 'text/plain' } },
        ),
    )
    .use(
      new Elysia({ name: 'scoped-proof' })
        .onBeforeHandle(({ set }) => {
          set.headers['x-scoped'] = 'yes';
        })
        .get('/_proof/scoped', () => ({ ok: true })),
    )
    .get('/_proof/unscoped', () => ({ ok: true }));
}
