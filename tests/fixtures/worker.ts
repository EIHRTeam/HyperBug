import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createProofApp } from './proof-app.ts';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';

export default createProofApp({
  adapter: CloudflareAdapter,
  config: loadConfig({
    HYPERBUG_ENV: 'local',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    REQUEST_TIMEOUT_MS: 100,
    MAX_BODY_BYTES: '1024',
  }),
  telemetry: jsonTelemetry(() => {}),
  ready: async () => true,
}).compile();
