import { env } from 'cloudflare:workers';
import { createCloudflareApi } from './composition.ts';

// No Argon2id runtime or Wasm import enters this profile's dependency graph.
export default createCloudflareApi(env);
