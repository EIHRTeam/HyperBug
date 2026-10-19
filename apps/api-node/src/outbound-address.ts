import { BlockList, isIP } from 'node:net';
import { canonicalIpAddress } from '@hyperbug/security';

// Conservative IANA special-use exclusions. A deployment firewall remains
// necessary because address classification cannot constrain network routing.
const blockedV4 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blockedV4.addSubnet(network, prefix, 'ipv4');

const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [network, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  blockedV6.addSubnet(network, prefix, 'ipv6');

/** Fail closed on malformed, non-unicast and special-use DNS answers. */
export function isPublicOutboundAddress(value: string): boolean {
  try {
    const address = canonicalIpAddress(value);
    const family = isIP(address);
    if (family === 4) return !blockedV4.check(address, 'ipv4');
    if (family === 6)
      return (
        globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6')
      );
    return false;
  } catch {
    return false;
  }
}
