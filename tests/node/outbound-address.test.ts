import { expect, it } from 'vitest';
import { isPublicOutboundAddress } from '../../apps/api-node/src/outbound-address.ts';

it('admits ordinary public unicast addresses and denies special-use or ambiguous DNS answers', () => {
  for (const address of [
    '1.1.1.1',
    '8.8.8.8',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
  ])
    expect(isPublicOutboundAddress(address), address).toBe(true);
  for (const address of [
    '0.0.0.1',
    '10.2.3.4',
    '100.100.100.200',
    '127.0.0.1',
    '169.254.169.254',
    '172.20.1.1',
    '192.0.0.9',
    '192.0.2.4',
    '192.88.99.1',
    '192.168.1.1',
    '198.18.0.49',
    '198.19.1.1',
    '198.51.100.4',
    '203.0.113.4',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:192.168.1.1',
    '::ffff:0:c612:31',
    '64:ff9b::127.0.0.1',
    '100::1',
    '2001::1',
    '2001:db8::1',
    '2002:c0a8:0101::1',
    '3fff::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '0127.0.0.1',
    'localhost',
    '127.0.0.1, 8.8.8.8',
  ])
    expect(isPublicOutboundAddress(address), address).toBe(false);
});
