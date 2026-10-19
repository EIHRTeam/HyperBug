import { validVolumetricKey, type VolumetricLimiter } from '@hyperbug/security';

export interface LocalVolumetricPolicy {
  readonly limit: number;
  readonly windowMs: number;
  readonly maxKeys: number;
}

/** Per-process load shedding; PostgreSQL counters remain the sensitive gate. */
export function createNodeVolumetricLimiter(
  policy: LocalVolumetricPolicy,
): VolumetricLimiter {
  if (
    !Number.isSafeInteger(policy.limit) ||
    policy.limit < 1 ||
    policy.limit > 10000 ||
    !Number.isSafeInteger(policy.windowMs) ||
    policy.windowMs < 1000 ||
    policy.windowMs > 60000 ||
    !Number.isSafeInteger(policy.maxKeys) ||
    policy.maxKeys < 1 ||
    policy.maxKeys > 100000
  )
    throw new Error('Invalid local volumetric policy');
  const { limit, windowMs, maxKeys } = policy;
  const buckets = new Map<string, { start: number; count: number }>();
  return {
    async consume(digest, nowMs) {
      if (!validVolumetricKey(digest, nowMs))
        return { allowed: false, reason: 'unavailable' };
      const start = Math.floor(nowMs / windowMs) * windowMs;
      const existing = buckets.get(digest);
      if (existing && start < existing.start)
        return { allowed: false, reason: 'unavailable' };
      if (!existing || existing.start !== start) {
        if (!existing && buckets.size >= maxKeys) {
          let inspected = 0;
          for (const [key, value] of buckets) {
            if (value.start !== start) buckets.delete(key);
            if (++inspected >= 128) break;
          }
          if (buckets.size >= maxKeys)
            return { allowed: false, reason: 'unavailable' };
        }
        buckets.set(digest, { start, count: 1 });
        return { allowed: true };
      }
      existing.count = Math.min(existing.count + 1, limit + 1);
      return existing.count <= limit
        ? { allowed: true }
        : { allowed: false, reason: 'limited' };
    },
  };
}
