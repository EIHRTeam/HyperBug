import { Server } from 'node:http';
import { once } from 'node:events';
import type { createApp } from '@hyperbug/server';

/** Adapt the verified @elysia/node 1.4.6 callback lifecycle, including ephemeral ports. */
export async function listenNode(
  app: {
    listen(
      ...args: Parameters<ReturnType<typeof createApp>['listen']>
    ): unknown;
  },
  port: number,
  host = '127.0.0.1',
) {
  const options = { port, host };
  let activeServer: Server | undefined;
  app.listen(options, (info) => {
    // The adapter currently leaves app.server unset and exposes the Node listener through raw.
    const raw = 'raw' in info ? info.raw : undefined;
    if (
      raw &&
      typeof raw === 'object' &&
      'node' in raw &&
      raw.node &&
      typeof raw.node === 'object' &&
      'server' in raw.node &&
      raw.node.server instanceof Server
    ) {
      activeServer = raw.node.server;
    }
  });
  if (!activeServer) throw new Error('Unsupported Node adapter listener shape');
  const server: Server = activeServer;
  if (!server.listening) await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected a TCP listener');
  return {
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
  };
}
