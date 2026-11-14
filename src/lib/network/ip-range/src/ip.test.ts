import { describe, expect, it } from 'vitest';
import {
  findMatchingCidr,
  ipRateLimitKey,
  isIpInCidr,
  isValidCidr,
  isValidIp,
  normalizeCidr,
  normalizeIp
} from './ip';

describe('normalizeIp', () => {
  it('normalizes ipv4 and ipv6 addresses', () => {
    expect(normalizeIp(' 10.0.0.1 ')).toBe('10.0.0.1');
    expect(normalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
  });

  it('unwraps ipv4-mapped ipv6 addresses', () => {
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
  });

  it('rejects invalid input', () => {
    expect(normalizeIp('not-an-ip')).toBeUndefined();
    expect(isValidIp('300.1.1.1')).toBe(false);
  });
});

describe('normalizeCidr', () => {
  it('returns the network address', () => {
    expect(normalizeCidr('10.1.2.3/8')).toBe('10.0.0.0/8');
    expect(normalizeCidr('2001:db8::1/32')).toBe('2001:db8::/32');
  });

  it('rejects invalid cidrs', () => {
    expect(normalizeCidr('10.0.0.0/33')).toBeUndefined();
    expect(isValidCidr('nope')).toBe(false);
  });
});

describe('isIpInCidr', () => {
  it('matches ipv4 ranges', () => {
    expect(isIpInCidr('10.0.5.1', '10.0.0.0/16')).toBe(true);
    expect(isIpInCidr('10.1.0.1', '10.0.0.0/16')).toBe(false);
  });

  it('matches ipv6 ranges', () => {
    expect(isIpInCidr('2001:db8::abcd', '2001:db8::/32')).toBe(true);
    expect(isIpInCidr('2001:db9::1', '2001:db8::/32')).toBe(false);
  });

  it('matches ipv4-mapped addresses against ipv4 ranges', () => {
    expect(isIpInCidr('::ffff:10.0.0.1', '10.0.0.0/8')).toBe(true);
  });

  it('never matches across families', () => {
    expect(isIpInCidr('10.0.0.1', '::/0')).toBe(false);
  });

  it('applies the prefix mask to cidrs with host bits set', () => {
    expect(isIpInCidr('198.51.100.3', '198.51.100.7/24')).toBe(true);
    expect(isIpInCidr('198.51.100.200', '198.51.100.7/24')).toBe(true);
    expect(isIpInCidr('198.51.101.1', '198.51.100.7/24')).toBe(false);
    expect(isIpInCidr('2001:db8:ffff::1', '2001:db8::5/32')).toBe(true);
    expect(isIpInCidr('2001:db9::1', '2001:db8::5/32')).toBe(false);
  });
});

describe('findMatchingCidr', () => {
  it('returns the first matching cidr', () => {
    expect(findMatchingCidr('192.168.1.10', ['10.0.0.0/8', '192.168.0.0/16'])).toBe(
      '192.168.0.0/16'
    );
  });

  it('applies the prefix mask to cidrs with host bits set', () => {
    expect(findMatchingCidr('198.51.100.3', ['198.51.100.7/24'])).toBe('198.51.100.7/24');
    expect(findMatchingCidr('198.51.101.1', ['198.51.100.7/24'])).toBeUndefined();
  });

  it('ignores invalid cidrs and returns undefined without a match', () => {
    expect(findMatchingCidr('8.8.8.8', ['bad', '10.0.0.0/8'])).toBeUndefined();
  });
});

describe('ipRateLimitKey', () => {
  it('uses the address for ipv4', () => {
    expect(ipRateLimitKey('1.2.3.4')).toBe('1.2.3.4');
  });

  it('uses the /64 network for ipv6', () => {
    expect(ipRateLimitKey('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(ipRateLimitKey('2001:db8:1:2:ffff::1')).toBe('2001:db8:1:2::/64');
  });

  it('supports a custom ipv6 prefix', () => {
    expect(ipRateLimitKey('2001:db8:1:2::1', { ipv6PrefixLength: 48 })).toBe(
      '2001:db8:1::/48'
    );
  });

  it('returns undefined for invalid input', () => {
    expect(ipRateLimitKey('nope')).toBeUndefined();
  });
});
