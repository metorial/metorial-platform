import { describe, expect, it } from 'vitest';
import { murmur3_32 } from './murmur3';

describe('murmur3_32', () => {
  it('returns 0 for empty string with default seed', () => {
    expect(murmur3_32('')).toBe(0);
  });

  it('returns correct hash for known input with default seed', () => {
    expect(murmur3_32('foo')).toBe(4138058784);
    expect(murmur3_32('bar')).toBe(1158584717);
    expect(murmur3_32('baz')).toBe(4050152682);
    expect(murmur3_32('The quick brown fox jumps over the lazy dog')).toBe(776992547);
  });

  it('returns correct hash for known input with custom seed', () => {
    expect(murmur3_32('foo', 42)).toBe(2972666014);
    expect(murmur3_32('bar', 1234)).toBe(1767229408);
    expect(murmur3_32('baz', 999)).toBe(1947074607);
  });

  it('produces different hashes for different strings', () => {
    const hash1 = murmur3_32('hello');
    const hash2 = murmur3_32('world');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different seeds', () => {
    const str = 'seeded';
    const hash1 = murmur3_32(str, 1);
    const hash2 = murmur3_32(str, 2);
    expect(hash1).not.toBe(hash2);
  });

  it('returns a 32-bit unsigned integer', () => {
    const hash = murmur3_32('test');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });

  it('handles unicode characters', () => {
    expect(murmur3_32('你好')).toBe(3865246988);
    expect(murmur3_32('😀😃😄😁')).toBe(3773368581);
  });

  it('handles long strings', () => {
    const longStr = 'a'.repeat(1000);
    expect(typeof murmur3_32(longStr)).toBe('number');
  });
});
