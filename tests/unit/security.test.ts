import { describe, expect, it } from 'vitest';
import { loadConfig, type SecurityEnvironment } from '@hyperbug/config';
import {
  jsonTelemetry,
  jsonSecurityTelemetry,
  type SecurityObservation,
} from '@hyperbug/observability';
import {
  publicFailure,
  RequestFailure,
} from '../../packages/server/src/errors.ts';
import {
  securityScenarios,
  expectedSecurityScenarios,
} from '../fixtures/security-scenarios.ts';

const environment = {
  HYPERBUG_ENV: 'production',
  ALLOWED_ORIGINS: 'https://issues.example.org',
};

describe('security configuration and safe output', () => {
  it('fails closed on debug, wildcard origins and coercible or out-of-budget values', () => {
    for (const changes of [
      { DEBUG: 'true' },
      { DEBUG: '1' },
      { DEBUG: true },
      { ALLOWED_ORIGINS: 'https://*.pages.dev' },
      { MAX_JSON_DEPTH: 33 },
      { MAX_JSON_NODES: '1e3' },
      { MAX_QUERY_PARAMETERS: '0x40' },
      { MAX_JSON_OBJECT_KEYS: true },
      { MAX_BODY_BYTES: ' 1024' },
      { ADMIN_RECENT_AUTH_SECONDS: 901 },
      { AUTHORIZATION_TIMEOUT_MS: 0 },
      { RETENTION_AUDIT_SECONDS: 0 },
      { RETENTION_SECURITY_LOG_SECONDS: 'Infinity' },
    ])
      expect(() =>
        loadConfig({ ...environment, ...changes }, 'node'),
      ).toThrow();
    expect(
      loadConfig(
        { ...environment, HYPERBUG_ENV: 'local', DEBUG: 'true' },
        'node',
      ).security.debug,
    ).toBe(true);
    expect(() =>
      loadConfig(
        { ...environment, HYPERBUG_ENV: 'staging', DEBUG: 'true' },
        'node',
      ),
    ).toThrow();
  });
  it('retains separate immutable settings for all seven retention purposes', () => {
    const settings = {
      RETENTION_SECURITY_LOG_SECONDS: '172800',
      RETENTION_AUDIT_SECONDS: '345600',
      RETENTION_ABUSE_SECONDS: '3600',
      RETENTION_EXPIRED_SESSION_SECONDS: '7200',
      RETENTION_DELETED_ACCOUNT_SECONDS: '10800',
      RETENTION_TEMPORARY_UPLOAD_SECONDS: '14400',
      RETENTION_EXPORT_SECONDS: '18000',
    } satisfies SecurityEnvironment;
    const security = loadConfig(
      { ...environment, ...settings },
      'node',
    ).security;
    expect(security.retentionSeconds).toEqual({
      securityLogs: 172800,
      audit: 345600,
      abuseMetadata: 3600,
      expiredSessions: 7200,
      deletedAccounts: 10800,
      temporaryUploads: 14400,
      exports: 18000,
    });
    for (const value of [
      security,
      security.input,
      security.authorization,
      security.retentionSeconds,
    ])
      expect(Object.isFrozen(value)).toBe(true);
  });
  it('removes seeded credentials, bodies, provider messages and malformed identifiers from diagnostics', () => {
    const logs: string[] = [];
    const marker = 'SEEDED_SECRET';
    const observation = {
      requestId: crypto.randomUUID(),
      route: 'health.live' as const,
      status: 403,
      durationMs: 2,
      component: 'authorization' as const,
      outcome: 'denied' as const,
      password: marker,
      Authorization: marker,
      Cookie: marker,
      refreshToken: marker,
      clientSecret: marker,
      body: { password: marker },
      cause: new Error(marker),
      principalId: marker,
      projectId: marker,
    };
    jsonTelemetry((line) => logs.push(line)).request(observation);
    jsonSecurityTelemetry((line) => logs.push(line)).event(observation);
    jsonSecurityTelemetry((line) => logs.push(line)).event({
      ...observation,
      requestId: marker,
      component: marker,
      outcome: marker,
    } as unknown as SecurityObservation);
    expect(logs.join('')).not.toMatch(
      /SEEDED_SECRET|password|Authorization|Cookie|refreshToken|clientSecret|body|cause/,
    );
    expect(JSON.parse(logs[3] ?? '{}')).toEqual({
      type: 'security',
      event: 'security.check',
      requestId: observation.requestId,
      component: 'authorization',
      outcome: 'denied',
    });
  });
  it('does not serialize free-form expected errors or invalid error codes', () => {
    const failure = new RequestFailure('FORBIDDEN');
    failure.message = 'SEEDED_SECRET';
    expect(publicFailure(failure, 'UNKNOWN')).toEqual({
      code: 'FORBIDDEN',
      status: 403,
      message: 'Access denied.',
    });
    expect(
      publicFailure(new RequestFailure('__proto__' as never), 'UNKNOWN').code,
    ).toBe('INTERNAL_ERROR');
    expect(
      JSON.stringify(publicFailure(new Error('SEEDED_SECRET'), 'UNKNOWN')),
    ).not.toContain('SEEDED_SECRET');
  });
  it('only exposes a bounded rate-limit retry hint', () => {
    const failure = new RequestFailure('RATE_LIMITED', 37);
    expect(publicFailure(failure, 'UNKNOWN')).toEqual({
      code: 'RATE_LIMITED',
      status: 429,
      message: 'Request rate limit exceeded.',
      retryAfterSeconds: 37,
    });
    Object.assign(failure, { retryAfterSeconds: 999999999 });
    expect(publicFailure(failure, 'UNKNOWN')).toEqual({
      code: 'RATE_LIMITED',
      status: 429,
      message: 'Request rate limit exceeded.',
    });
    expect(() => new RequestFailure('RATE_LIMITED', Number.NaN)).toThrow();
    expect(() => new RequestFailure('FORBIDDEN', 37)).toThrow();
    expect(
      publicFailure(new RequestFailure('RATE_LIMIT_UNAVAILABLE'), 'UNKNOWN'),
    ).toEqual({
      code: 'RATE_LIMIT_UNAVAILABLE',
      status: 503,
      message: 'Request rate limit verification is unavailable.',
    });
  });
});

it('enforces current object permissions, assurance and bounded fail-closed providers', async () => {
  expect(await securityScenarios()).toEqual(expectedSecurityScenarios);
});
