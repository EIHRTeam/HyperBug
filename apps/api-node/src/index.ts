import { listenNode } from './listen.ts';
import { node } from '@elysia/node';
import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';

const config = loadConfig(process.env);
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid PORT');
const app = createApp({
  adapter: node(),
  config,
  telemetry: jsonTelemetry((line) => console.log(line)),
  ready: async () => true,
});
const listener = await listenNode(app, port, process.env.HOST ?? '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void listener.close();
  });
