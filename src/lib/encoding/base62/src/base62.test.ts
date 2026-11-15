import { describe, expect, test } from 'vitest';
import { base62 } from './base62';

describe('base62', () => {
  test('should encode strings', () => {
    expect(base62.encode('foo')).toBe('sapp');
    expect(base62.encode('bar')).toBe('r3hw');
  });

  test('should decode strings', () => {
    expect(base62.decode('sapp')).toBe('foo');
    expect(base62.decode('r3hw')).toBe('bar');
  });

  test('should encode and decode strings', () => {
    expect(base62.decode(base62.encode('foo'))).toBe('foo');
    expect(base62.decode(base62.encode('bar'))).toBe('bar');
  });
});
