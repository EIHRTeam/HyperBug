import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const config = fileURLToPath(
  new URL('../apps/api-cloudflare/wrangler.jsonc', import.meta.url),
);
const localTurnstileVars = fileURLToPath(
  new URL('../apps/api-cloudflare/.dev.vars.local-turnstile', import.meta.url),
);
const wrangler = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
);
const args = process.argv.slice(2);
const explicitEnvironment = args.some(
  (arg) => arg === '--env' || arg.startsWith('--env='),
);
const hasTurnstileEnvironment = [
  'TURNSTILE_SECRET',
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_HOSTNAME',
].some((name) => Object.hasOwn(process.env, name));
const environment =
  !explicitEnvironment &&
  (existsSync(localTurnstileVars) || hasTurnstileEnvironment)
    ? ['--env', 'local-turnstile']
    : [];
const child = spawn(
  process.execPath,
  [wrangler, 'dev', '--config', config, ...environment, ...args],
  { stdio: 'inherit' },
);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
