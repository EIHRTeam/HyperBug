import { validVolumetricKey, type VolumetricLimiter } from '@hyperbug/security';

export interface WorkersRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Cloudflare's binding is location scoped and eventually consistent. */
export function createCloudflareVolumetricLimiter(
  binding: WorkersRateLimitBinding,
): VolumetricLimiter {
  return {
    async consume(digest, nowMs) {
      if (!validVolumetricKey(digest, nowMs))
        return { allowed: false, reason: 'unavailable' };
      try {
        const outcome = await binding.limit({ key: digest });
        if (outcome.success === true) return { allowed: true };
        if (outcome.success === false)
          return { allowed: false, reason: 'limited' };
      } catch {
        // An unavailable limiter never grants the dependent request.
      }
      return { allowed: false, reason: 'unavailable' };
    },
  };
}
