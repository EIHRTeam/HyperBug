import { build } from 'esbuild';
await build({
  entryPoints: ['apps/api-node/src/index.ts'],
  outfile: 'dist/node/index.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: ['@elysia/node', 'elysia'],
});
await build({
  entryPoints: ['apps/api-cloudflare/src/index.ts'],
  outfile: 'dist/cloudflare/index.mjs',
  bundle: true,
  platform: 'neutral',
  mainFields: ['browser', 'module', 'main'],
  format: 'esm',
  target: 'es2023',
  conditions: ['workerd', 'worker', 'browser'],
  external: ['node:*', 'cloudflare:*'],
});
