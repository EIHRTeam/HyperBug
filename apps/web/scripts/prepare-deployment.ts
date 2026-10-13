import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateRuntimeConfig,
  publicOrigin,
  type RuntimeConfig,
} from '../src/runtime-config.ts';
import {
  reviewedPluginOrigins,
  type ReviewedPluginOrigins,
} from '../src/plugins.ts';

export function deploymentPolicy(
  config: RuntimeConfig,
  plugins: readonly ReviewedPluginOrigins[] = reviewedPluginOrigins,
) {
  const origins = (kind: 'connect' | 'images' | 'frames' | 'scripts') =>
    [
      ...new Set(plugins.flatMap((plugin) => plugin[kind].map(publicOrigin))),
    ].sort();
  const csp = [
    "default-src 'none'",
    `script-src 'self' ${origins('scripts').join(' ')}`.trim(),
    "script-src-attr 'none'",
    "style-src 'self'",
    "style-src-attr 'none'",
    `img-src 'self' data: blob: ${[...config.mediaOrigins, ...origins('images')].join(' ')}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${[...new Set([config.apiBaseUrl, config.authBaseUrl, ...origins('connect')])].join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    `form-action 'self' ${config.authBaseUrl}`,
    `frame-src ${origins('frames').length ? origins('frames').join(' ') : "'none'"}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ].join('; ');
  if (csp.length + '  Content-Security-Policy: '.length > 2000)
    throw new Error('Deployment CSP exceeds the portable Pages header limit');
  return {
    headers: {
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
    cache: {
      html: 'no-cache',
      config: 'no-store',
      assets: 'public, max-age=31536000, immutable',
      other: 'no-cache',
    },
    spaFallback: '/index.html',
  };
}

export async function prepareDeployment(
  directory: string,
  configPath?: string,
) {
  const config = validateRuntimeConfig(
    JSON.parse(
      await readFile(configPath ?? resolve(directory, 'config.json'), 'utf8'),
    ),
  );
  const policy = deploymentPolicy(config);
  const lines = [
    '/*',
    ...Object.entries(policy.headers).map(
      ([key, value]) => `  ${key}: ${value}`,
    ),
    `  Cache-Control: ${policy.cache.html}`,
    '/config.json',
    '  ! Cache-Control',
    `  Cache-Control: ${policy.cache.config}`,
    '/assets/*',
    '  ! Cache-Control',
    `  Cache-Control: ${policy.cache.assets}`,
    '',
  ];
  // Host-neutral policy is canonical; _headers/_redirects are Pages adapters.
  await writeFile(
    resolve(directory, 'config.json'),
    JSON.stringify(config, null, 2) + '\n',
  );
  await writeFile(
    resolve(directory, 'hosting.json'),
    JSON.stringify(policy, null, 2) + '\n',
  );
  await writeFile(resolve(directory, '_headers'), lines.join('\n'));
  await writeFile(resolve(directory, '_redirects'), '/* /index.html 200\n');
  return policy;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL('../dist', import.meta.url));
  const option = (name: string) =>
    process.argv
      .find((x) => x.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  await prepareDeployment(resolve(option('dir') ?? root), option('config'));
  console.log(
    'Prepared public runtime configuration and static hosting policy.',
  );
}
