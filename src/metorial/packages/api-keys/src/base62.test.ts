import { describe, expect, test } from 'vitest';
import { decodeBase62, encodeBase62 } from './base62';

describe('base62', () => {
  test('should encode strings', () => {
    expect(encodeBase62('foo')).toBe('SAPP');
    expect(encodeBase62('bar')).toBe('R3HW');
  });

  test('should decode strings', () => {
    expect(decodeBase62('SAPP')).toBe('foo');
    expect(decodeBase62('R3HW')).toBe('bar');
  });

  test('should encode and decode strings', () => {
    expect(decodeBase62(encodeBase62('foo'))).toBe('foo');
    expect(decodeBase62(encodeBase62('bar'))).toBe('bar');
  });

  test('should encode and decode buffers', () => {
    const buffer = Buffer.from('hello');
    expect(decodeBase62(encodeBase62(buffer))).toBe('hello');
  });

  test('should handle empty strings', () => {
    expect(encodeBase62('\0')).toBe('0');
    expect(decodeBase62('0')).toBe('\0');
  });

  test('should throw error for invalid characters in decode', () => {
    expect(() => decodeBase62('!@#$')).toThrow('Invalid character');
  });

  test('should handle large inputs', () => {
    const largeInput = 'a'.repeat(100);
    expect(decodeBase62(encodeBase62(largeInput))).toBe(largeInput);
  });
});
