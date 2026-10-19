import { expect, it } from 'vitest';
import { canonicalIpAddress } from '../../packages/security/src/ip-address.ts';
import { RateLimitFailure } from '../../packages/security/src/rate-limit.ts';

it('canonicalizes strict IPv4, IPv6 and mapped IPv4 addresses', () => {
  expect(canonicalIpAddress('203.0.113.7')).toBe('203.0.113.7');
  expect(canonicalIpAddress('2001:0DB8:0000:0:0:0:0:1')).toBe('2001:db8::1');
  expect(canonicalIpAddress('2001:db8::1')).toBe('2001:db8::1');
  expect(canonicalIpAddress('::ffff:192.0.2.1')).toBe('192.0.2.1');
  expect(canonicalIpAddress('::ffff:c000:201')).toBe('192.0.2.1');
});

it('rejects hostnames, forwarded chains, ports, zones and noncanonical IPv4', () => {
  for (const value of [
    null,
    '',
    ' localhost',
    'example.org',
    '203.0.113.7, 198.51.100.2',
    '203.0.113.7:443',
    '203.000.113.7',
    '256.0.0.1',
    '0.0.0.0',
    '[::1]',
    '::',
    'fe80::1%en0',
    'http://203.0.113.7/',
  ])
    expect(() => canonicalIpAddress(value)).toThrow(RateLimitFailure);
});
