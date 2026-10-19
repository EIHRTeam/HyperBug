import { RateLimitFailure } from './rate-limit.ts';

const ipv4 = /^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$/;
const ipv6Characters = /^[0-9a-fA-F:.]+$/;
const mappedIpv4 = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;

/** Normalize an address supplied by a separately verified ingress boundary. */
export function canonicalIpAddress(value: unknown): string {
  if (typeof value !== 'string' || value.length < 2 || value.length > 64)
    throw new RateLimitFailure();

  if (ipv4.test(value)) {
    const octets = value.split('.').map(Number);
    if (
      octets.some((octet) => octet > 255) ||
      octets.every((octet) => octet === 0)
    )
      throw new RateLimitFailure();
    return value;
  }

  if (!value.includes(':') || !ipv6Characters.test(value))
    throw new RateLimitFailure();
  try {
    const host = new URL(`http://[${value}]/`).hostname;
    if (!host.startsWith('[') || !host.endsWith(']'))
      throw new RateLimitFailure();
    const normalized = host.slice(1, -1);
    if (normalized === '::') throw new RateLimitFailure();
    const mapped = mappedIpv4.exec(normalized);
    if (mapped) {
      const high = Number.parseInt(mapped[1]!, 16);
      const low = Number.parseInt(mapped[2]!, 16);
      return canonicalIpAddress(
        `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
      );
    }
    return normalized;
  } catch {
    throw new RateLimitFailure();
  }
}
