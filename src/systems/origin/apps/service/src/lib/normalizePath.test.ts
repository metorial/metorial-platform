import { describe, expect, it } from 'vitest';
import { normalizePath } from './normalizePath';

describe('normalizePath', () => {
  it('resolves parent and current directory segments', () => {
    expect(normalizePath('foo/../bar/./baz')).toBe('/bar/baz');
    expect(normalizePath('/a/b/../c')).toBe('/a/c');
  });

  it('returns root for empty paths', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('/')).toBe('/');
  });
});
