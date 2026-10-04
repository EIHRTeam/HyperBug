/**
 * Every route label the server can emit. This one frozen list is the single
 * source for the RouteLabel type, the server's route matching and the
 * jsonTelemetry serialization allowlist, so a new route can never appear in
 * one place and fall out of another.
 */
export const ROUTE_LABELS = [
  'health.live',
  'health.ready',
  'account.register',
  'account.login',
  'account.session',
  'account.logout',
  'account.bootstrap',
  'account.instance',
  'account.account',
  'account.recovery-codes',
  'account.recover',
  'account.passkey',
  'account.authorize',
  'account.token',
  'account.sessions',
  'admin.principal',
  'admin.plugins',
  'project.members',
  'project.read',
  'project.manage',
  'project.taxonomy',
  'project.content',
  'project.upload',
  'attachment.media',
  'issue.read',
  'issue.write',
  'issue.triage',
  'issue.discussion',
  'proof',
] as const;

/** The closed fallback for any observation outside the labeled routes. */
export type RouteLabel = (typeof ROUTE_LABELS)[number] | 'unmatched';

const serializableRoutes: ReadonlySet<string> = new Set(ROUTE_LABELS);
export interface RequestObservation {
  requestId: string;
  route: RouteLabel;
  status: number;
  durationMs: number;
}
export interface Telemetry {
  request(observation: RequestObservation): void;
  security?(observation: SecurityObservation): void;
}

/** Allowlisted serialization: never accepts request bodies, URLs, headers, or errors. */
export function jsonTelemetry(write: (line: string) => void): Telemetry {
  return {
    security: jsonSecurityTelemetry(write).event,
    request(observation) {
      const route = serializableRoutes.has(observation.route)
        ? observation.route
        : 'unmatched';
      const status =
        Number.isInteger(observation.status) &&
        observation.status >= 100 &&
        observation.status <= 599
          ? observation.status
          : 500;
      const durationMs = Number.isFinite(observation.durationMs)
        ? Math.max(0, observation.durationMs)
        : 0;
      const requestId = safeId(observation.requestId)
        ? observation.requestId
        : 'invalid';
      write(
        JSON.stringify({
          type: 'log',
          event: 'http.request',
          requestId,
          route,
          status,
        }),
      );
      write(
        JSON.stringify({
          type: 'metric',
          name: 'http.server.duration',
          value: durationMs,
          unit: 'ms',
          attributes: { route, statusClass: `${Math.floor(status / 100)}xx` },
        }),
      );
      write(
        JSON.stringify({
          type: 'trace',
          name: route,
          requestId,
          durationMs,
          status,
        }),
      );
    },
  };
}

function safeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
  );
}

export interface SecurityObservation {
  requestId: string;
  component:
    | 'authorization'
    | 'token'
    | 'key'
    | 'captcha'
    | 'plugin'
    | 'rate'
    | 'request';
  outcome: 'denied' | 'unavailable' | 'invalid';
  principalId?: string;
  projectId?: string;
}

/** Security diagnostics are not durable audit. Drop all free-form/provider data. */
export function jsonSecurityTelemetry(write: (line: string) => void) {
  return {
    event(observation: SecurityObservation): void {
      const component = [
        'authorization',
        'token',
        'key',
        'captcha',
        'plugin',
        'rate',
        'request',
      ].includes(observation.component)
        ? observation.component
        : 'unknown';
      const outcome = ['denied', 'unavailable', 'invalid'].includes(
        observation.outcome,
      )
        ? observation.outcome
        : 'invalid';
      write(
        JSON.stringify({
          type: 'security',
          event: 'security.check',
          requestId: safeId(observation.requestId)
            ? observation.requestId
            : 'invalid',
          component,
          outcome,
          ...(safeId(observation.principalId)
            ? { principalId: observation.principalId }
            : {}),
          ...(safeId(observation.projectId)
            ? { projectId: observation.projectId }
            : {}),
        }),
      );
    },
  };
}
