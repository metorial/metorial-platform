import { describe, expect, it } from 'vitest';
import { anonymizeIP } from './anonymizeIp';

describe('anonymizeIP', () => {
  // IPv4 tests
  it('anonymizes IPv4 with default options', () => {
    expect(anonymizeIP('192.168.1.100')).toBe('192.168.x.xxx');
  });

  it('anonymizes IPv4 with keepGroups=1', () => {
    expect(anonymizeIP('10.20.30.40', { keepGroups: 1 })).toBe('10.xx.xx.xx');
  });

  it('anonymizes IPv4 with keepGroups=3', () => {
    expect(anonymizeIP('8.8.8.8', { keepGroups: 3 })).toBe('8.8.8.x');
  });

  it('anonymizes IPv4 with custom maskChar', () => {
    expect(anonymizeIP('127.0.0.1', { maskChar: '*' })).toBe('127.0.*.*');
  });

  it('throws error for invalid IPv4 keepGroups', () => {
    expect(() => anonymizeIP('1.2.3.4', { keepGroups: 0 })).toThrow();
    expect(() => anonymizeIP('1.2.3.4', { keepGroups: 4 })).toThrow();
  });

  // IPv6 tests
  it('anonymizes IPv6 with default options', () => {
    expect(anonymizeIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
      '2001:0db8:85a3:0000:xxxx:xxxx:xxxx:xxxx'
    );
  });

  it('anonymizes IPv6 with keepGroups=2', () => {
    expect(anonymizeIP('fe80:abcd:1234:5678:9abc:def0:1234:5678', { keepGroups: 2 })).toBe(
      'fe80:abcd:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx'
    );
  });

  it('anonymizes IPv6 with keepGroups=7', () => {
    expect(anonymizeIP('1:2:3:4:5:6:7:8', { keepGroups: 7 })).toBe('1:2:3:4:5:6:7:x');
  });

  it('anonymizes IPv6 with custom maskChar', () => {
    expect(anonymizeIP('abcd:ef01:2345:6789:abcd:ef01:2345:6789', { maskChar: '*' })).toBe(
      'abcd:ef01:2345:6789:****:****:****:****'
    );
  });

  it('throws error for invalid IPv6 keepGroups', () => {
    expect(() =>
      anonymizeIP('abcd:ef01:2345:6789:abcd:ef01:2345:6789', { keepGroups: 0 })
    ).toThrow();
    expect(() =>
      anonymizeIP('abcd:ef01:2345:6789:abcd:ef01:2345:6789', { keepGroups: 8 })
    ).toThrow();
  });

  // IPv6 compressed notation
  it('anonymizes IPv6 compressed notation', () => {
    expect(anonymizeIP('2001:db8::1')).toBe('2001:db8:0:0:x:x:x:x');
  });

  it('anonymizes IPv6 ::', () => {
    expect(anonymizeIP('::')).toBe('0:0:0:0:x:x:x:x');
  });

  // IPv6 with embedded IPv4
  it('anonymizes IPv6 with embedded IPv4', () => {
    expect(anonymizeIP('::ffff:192.0.2.128')).toBe('0:0:0:0:x:x:xxxx:192.0.x.xxx');
    expect(anonymizeIP('2001:db8::ffff:10.0.0.1')).toBe('2001:db8:x:x:x:x:x:x.0.0.x');
  });

  // Invalid IPs
  it('throws error for invalid IP address', () => {
    expect(() => anonymizeIP('not.an.ip')).toThrow();
    expect(() => anonymizeIP('')).toThrow();
    expect(() => anonymizeIP('1234')).toThrow();
    expect(() => anonymizeIP('256.256.256.256')).toThrow();
    expect(() => anonymizeIP('abcd:ef01:2345:6789:abcd:ef01:2345:6789:abcd')).toThrow();
  });

  // Whitespace trimming
  it('trims whitespace from IP', () => {
    expect(anonymizeIP('  192.168.1.100  ')).toBe('192.168.x.xxx');
  });
});
