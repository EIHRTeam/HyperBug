import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareDeployment } from './prepare-deployment.ts';

// A portable static-host example only: no API routes, proxies, SSR or Functions.
const option = (name: string) =>
  process.argv.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(
  option('dir') ?? fileURLToPath(new URL('../dist', import.meta.url)),
);
const port = Number(option('port') ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid static server port');
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};
await prepareDeployment(root);
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    let file = resolve(root, '.' + pathname);
    if (
      (file !== root && !file.startsWith(root + sep)) ||
      pathname.includes('\0')
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    // Never serve host metadata or Vite's build manifest.
    if (
      pathname.startsWith('/.') ||
      ['/_headers', '/_redirects', '/hosting.json'].includes(pathname)
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) throw new Error('not file');
    } catch {
      if (extname(pathname)) {
        response.writeHead(404);
        response.end();
        return;
      }
      file = resolve(root, 'index.html');
    }
    const policy = JSON.parse(
      await readFile(resolve(root, 'hosting.json'), 'utf8'),
    ) as Awaited<ReturnType<typeof prepareDeployment>>;
    const cache =
      pathname === '/config.json'
        ? policy.cache.config
        : pathname.startsWith('/assets/')
          ? policy.cache.assets
          : extname(file) === '.html'
            ? policy.cache.html
            : policy.cache.other;
    const body = await readFile(file);
    response.writeHead(200, {
      ...policy.headers,
      'Cache-Control': cache,
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': body.length,
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500, { 'Cache-Control': 'no-store' });
    response.end('Static host unavailable');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Static frontend: http://127.0.0.1:${port}`),
);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => server.close());
