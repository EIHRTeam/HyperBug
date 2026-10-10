import { boundedInteger } from './security.ts';
/** Module09 scheduler-owned settings; historical audit/account policies remain independently owned. */
export function loadAsyncMaintenancePolicy(env: {
  ASYNC_ORPHAN_RETENTION_SECONDS?: unknown;
  ASYNC_TERMINAL_RETENTION_SECONDS?: unknown;
}) {
  return Object.freeze({
    orphanRetentionMs:
      boundedInteger(
        env.ASYNC_ORPHAN_RETENTION_SECONDS,
        86400,
        3600,
        31536000,
      ) * 1000,
    terminalRetentionMs:
      boundedInteger(
        env.ASYNC_TERMINAL_RETENTION_SECONDS,
        2592000,
        86400,
        31536000,
      ) * 1000,
  });
}
