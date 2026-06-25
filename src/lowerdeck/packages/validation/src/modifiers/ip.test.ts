import { describe, expect, test } from 'vitest';
import { ip } from './ip';

describe('ip', () => {
  test('should return an empty array for a valid IPv4 address', () => {
    let result = ip()('192.168.0.1');
    expect(result).toEqual([]);
  });

  test('should return an empty array for a valid IPv6 address', () => {
    let result = ip()('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    expect(result).toEqual([]);
  });

  test('should return an error object for an invalid IP address', () => {
    let result = ip()('invalid-ip-address');
    expect(result).toEqual([
      {
        code: 'invalid_ip',
        message: 'Invalid ip address'
      }
    ]);
  });

  test('should return a custom error message for an invalid IP address', () => {
    let result = ip({ message: 'Invalid IP address format' })('invalid-ip-address');
    expect(result).toEqual([
      {
        code: 'invalid_ip',
        message: 'Invalid IP address format'
      }
    ]);
  });
});
