import type { D1Database } from '@cloudflare/workers-types';
import { runMinimumAsyncTick } from '../../apps/api-cloudflare/src/async-minimum.ts';
export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const url = new URL(request.url),
      phase = Number(url.searchParams.get('phase')),
      now = Number(url.searchParams.get('now'));
    return Response.json(
      await runMinimumAsyncTick({
        db: env.DB,
        scheduledTime: phase * 300000,
        now: () => now,
        bindings: {},
        sessionRetentionMs: 86400000,
      }),
    );
  },
};
