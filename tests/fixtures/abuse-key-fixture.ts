import { encodeBase64Url } from '../../packages/security/src/crypto.ts';

/** Deterministic public test material; never provision this as an actual secret. */
export function abuseKeyFixture(): string {
  return JSON.stringify({
    v: 1,
    current: 2,
    keys: [
      { version: 2, material: encodeBase64Url(new Uint8Array(32).fill(21)) },
      { version: 1, material: encodeBase64Url(new Uint8Array(32).fill(20)) },
    ],
  });
}
