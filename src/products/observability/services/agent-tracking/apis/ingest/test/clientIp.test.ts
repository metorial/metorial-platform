import { describe, expect, it } from 'vitest';
import { clientIpOf, forwardedChain, normalizeClientIp } from '../src/clientIp';

describe('normalizeClientIp', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    [' 203.0.113.7 ', '203.0.113.7'],
    ['203.0.113.7:51234', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['[::ffff:cb00:7107]:443', '203.0.113.7'],
    ['2001:db8:85a3:1234:abcd:ef01:2345:6789', '2001:db8:85a3:1234::/64'],
    ['2001:DB8:85A3:1234::1', '2001:db8:85a3:1234::/64'],
    ['[2001:db8::1]:8080', '2001:db8:0:0::/64'],
    ['fe80::1%en0', 'fe80:0:0:0::/64'],
    ['::1', '0:0:0:0::/64']
  ])('normalizes %s', (raw, expected) => {
    expect(normalizeClientIp(raw)).toBe(expected);
  });

  it('groups addresses of one /64 together', () => {
    expect(normalizeClientIp('2001:db8:1:2:aaaa::1')).toBe(
      normalizeClientIp('2001:db8:1:2:bbbb:cccc:dddd:eeee')
    );
  });

  it.each([
    undefined,
    null,
    '',
    'unknown',
    '999.1.1.1',
    '1.2.3',
    'example.com',
    '2001:db8:::1'
  ])('rejects %s', raw => {
    expect(normalizeClientIp(raw)).toBeUndefined();
  });
});

describe('forwardedChain', () => {
  it('splits and trims entries', () => {
    expect(forwardedChain(' 1.1.1.1 , 2.2.2.2,,3.3.3.3 ')).toEqual([
      '1.1.1.1',
      '2.2.2.2',
      '3.3.3.3'
    ]);
    expect(forwardedChain(null)).toEqual([]);
  });
});

describe('clientIpOf', () => {
  it('takes the entry appended by the outermost trusted proxy', () => {
    expect(
      clientIpOf({
        forwardedFor: '6.6.6.6, 203.0.113.7',
        remoteAddress: '10.0.0.2',
        trustedHops: 1
      })
    ).toBe('203.0.113.7');
    expect(
      clientIpOf({
        forwardedFor: '6.6.6.6, 203.0.113.7, 10.0.0.9',
        remoteAddress: '10.0.0.2',
        trustedHops: 2
      })
    ).toBe('203.0.113.7');
  });

  it('ignores client-supplied entries left of the trusted ones', () => {
    expect(clientIpOf({ forwardedFor: '1.1.1.1, 203.0.113.7', trustedHops: 1 })).not.toBe(
      '1.1.1.1'
    );
  });

  it('falls back to the socket address', () => {
    expect(
      clientIpOf({ forwardedFor: null, remoteAddress: '203.0.113.9', trustedHops: 1 })
    ).toBe('203.0.113.9');
    expect(
      clientIpOf({
        forwardedFor: '203.0.113.7',
        remoteAddress: '198.51.100.1',
        trustedHops: 0
      })
    ).toBe('198.51.100.1');
    expect(
      clientIpOf({
        forwardedFor: '203.0.113.7',
        remoteAddress: '198.51.100.1',
        trustedHops: 3
      })
    ).toBe('198.51.100.1');
    expect(
      clientIpOf({ forwardedFor: 'garbage', remoteAddress: '198.51.100.1', trustedHops: 1 })
    ).toBe('198.51.100.1');
  });

  it('returns nothing without any valid address', () => {
    expect(clientIpOf({ forwardedFor: null, trustedHops: 1 })).toBeUndefined();
  });
});
