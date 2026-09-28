import { canonicalIpAddress, RateLimitFailure } from '@hyperbug/security';

const addressHeader = 'x-hyperbug-ingress-ip';
const timeHeader = 'x-hyperbug-ingress-time';
const signatureHeader = 'x-hyperbug-ingress-signature';
const maxAgeMs = 5000;

function decode(value: string, length: number): Uint8Array {
  if (
    typeof value !== 'string' ||
    !new RegExp(`^[A-Za-z0-9_-]{${length}}$`).test(value)
  )
    throw new RateLimitFailure();
  try {
    const bytes = Uint8Array.from(
      atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='),
      (character) => character.charCodeAt(0),
    );
    if (bytes.length !== 32 || encode(buffer(bytes)) !== value)
      throw new RateLimitFailure();
    return bytes;
  } catch {
    throw new RateLimitFailure();
  }
}

function encode(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function buffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function payload(request: Request, ip: string, issuedAt: string): Uint8Array {
  const url = new URL(request.url);
  return new TextEncoder().encode(
    `hyperbug-ingress-v1\n${request.method}\n${url.pathname}${url.search}\n${ip}\n${issuedAt}`,
  );
}

/** Share only with a controlled public ingress Worker and a private API Worker. */
export function createIngressAttestation(secret: string) {
  const material = decode(secret, 43);
  const key = crypto.subtle.importKey(
    'raw',
    buffer(material),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return Object.freeze({
    async sign(request: Request, rawIp: string): Promise<Headers> {
      const ip = canonicalIpAddress(rawIp);
      const issuedAt = String(Date.now());
      const headers = new Headers(request.headers);
      headers.delete(addressHeader);
      headers.delete(timeHeader);
      headers.delete(signatureHeader);
      for (const name of [
        'cf-connecting-ip',
        'x-real-ip',
        'true-client-ip',
        'x-forwarded-for',
        'forwarded',
        'cf-worker',
      ])
        headers.delete(name);
      const signature = await crypto.subtle.sign(
        'HMAC',
        await key,
        buffer(payload(request, ip, issuedAt)),
      );
      headers.set(addressHeader, ip);
      headers.set(timeHeader, issuedAt);
      headers.set(signatureHeader, encode(signature));
      return headers;
    },
    async verify(request: Request): Promise<string> {
      const ip = canonicalIpAddress(request.headers.get(addressHeader));
      const issuedAt = request.headers.get(timeHeader);
      const signature = request.headers.get(signatureHeader);
      if (
        request.signal.aborted ||
        typeof issuedAt !== 'string' ||
        !/^\d{13}$/.test(issuedAt) ||
        Math.abs(Date.now() - Number(issuedAt)) > maxAgeMs ||
        typeof signature !== 'string'
      )
        throw new RateLimitFailure();
      const valid = await crypto.subtle.verify(
        'HMAC',
        await key,
        buffer(decode(signature, 43)),
        buffer(payload(request, ip, issuedAt)),
      );
      if (!valid || request.signal.aborted) throw new RateLimitFailure();
      return ip;
    },
  });
}
