import { readFile } from 'node:fs/promises';
import { loadConfig, loadAsyncMaintenancePolicy } from '@hyperbug/config';
import { parseOAuthClients, parsePasskeyConfiguration } from '@hyperbug/server';

// Reads public policy only; does not read secret mounts, log policy or contact providers.
const [runtime, file] = process.argv.slice(2);
if (
  process.argv.length !== 4 ||
  !['node', 'cloudflare'].includes(runtime ?? '') ||
  !file
)
  throw new Error(
    'Use: node tooling/check-deployment.ts node|cloudflare public-policy.json',
  );
try {
  const policy = JSON.parse(await readFile(file, 'utf8'));
  if (!policy || Array.isArray(policy) || typeof policy !== 'object')
    throw new Error();
  const allowed =
    /^(HYPERBUG_ENV|ALLOWED_ORIGINS|DEBUG|HYPERBUG_DEPLOYMENT_TIER|HYPERBUG_DEGRADATION_ACK|HYPERBUG_OAUTH_CLIENTS|PASSKEY_RP_ID|PASSKEY_RP_NAME|PASSKEY_ORIGIN|MAX_BODY_BYTES|REQUEST_TIMEOUT_MS|ADMIN_RECENT_AUTH_SECONDS|AUTHORIZATION_TIMEOUT_MS|STORE_READ_TIMEOUT_MS|STORE_WRITE_TIMEOUT_MS|ASYNC_ORPHAN_RETENTION_SECONDS|ASYNC_TERMINAL_RETENTION_SECONDS|RETENTION_[A-Z_]+|MAX_JSON_[A-Z_]+|MAX_URL_LENGTH|MAX_QUERY_PARAMETERS|MAX_QUERY_VALUE_LENGTH)$/;
  if (Object.keys(policy).some((key) => !allowed.test(key))) throw new Error();
  loadConfig(policy, runtime === 'node' ? 'node' : 'cloudflare');
  loadAsyncMaintenancePolicy(policy);
  parseOAuthClients(policy.HYPERBUG_OAUTH_CLIENTS);
  parsePasskeyConfiguration({
    rpId: policy.PASSKEY_RP_ID,
    rpName: policy.PASSKEY_RP_NAME,
    origin: policy.PASSKEY_ORIGIN,
  });
  console.log(
    'Public deployment policy valid; bindings, secret availability, primary state, TLS, CORS and provider readiness require separate live checks.',
  );
} catch {
  throw new Error('Invalid public deployment policy');
}
