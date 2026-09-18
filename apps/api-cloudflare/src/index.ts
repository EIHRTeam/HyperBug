import { env } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';

// Workers permits AOT compilation during module initialization, before requests.
export default createApp({
  adapter: CloudflareAdapter,
  config: loadConfig(env),
  telemetry: jsonTelemetry((line) => console.log(line)),
  ready: async () => true,
}).compile();
