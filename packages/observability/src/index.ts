export type RouteLabel = 'health.live' | 'health.ready' | 'unmatched' | 'proof';
export interface RequestObservation {
  requestId: string;
  route: RouteLabel;
  status: number;
  durationMs: number;
}
export interface Telemetry {
  request(observation: RequestObservation): void;
}

/** Allowlisted serialization: never accepts request bodies, URLs, headers, or errors. */
export function jsonTelemetry(write: (line: string) => void): Telemetry {
  return {
    request(observation) {
      const route = ['health.live', 'health.ready', 'proof'].includes(
        observation.route,
      )
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
      const requestId = /^[0-9a-f-]{36}$/.test(observation.requestId)
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
