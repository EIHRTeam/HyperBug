import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

/** Local test infrastructure only. Credentials are random and scoped to this process. */
export async function startLocalS3({ port = 0, persistent = false } = {}) {
  const credentials = {
    accessKeyId: randomBytes(16).toString('hex'),
    secretAccessKey: randomBytes(32).toString('hex'),
  };
  const bucket = 'hyperbug-test';
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      host: '127.0.0.1',
      port,
      modules: true,
      script:
        'export default { fetch() { return new Response("Local storage fixture", { status: 404 }); } }',
      compatibilityDate: '2026-09-16',
      r2Buckets: { BLOB: { id: bucket, s3Credentials: credentials } },
      ...(persistent ? { r2Persist: '.local/s3-data' } : {}),
    }),
  );
  try {
    const base = await mf.ready;
    return {
      endpoint: new URL('/cdn-cgi/local/r2/s3', base).toString(),
      bucket,
      region: 'auto',
      forcePathStyle: true,
      credentials,
      close: () => mf.dispose(),
    };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await mkdir('.local', { recursive: true });
  const storage = await startLocalS3({ port: 7878, persistent: true });
  const configPath = '.local/s3.json';
  try {
    const { close: _close, ...configuration } = storage;
    await writeFile(configPath, `${JSON.stringify(configuration, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    console.log(
      `Local S3 service: ${storage.endpoint}; configuration saved to ${configPath}. Stop with Ctrl-C.`,
    );
    await new Promise<void>((resolveStop) => {
      process.once('SIGINT', resolveStop);
      process.once('SIGTERM', resolveStop);
    });
    await unlink(configPath);
  } finally {
    await storage.close();
  }
}
