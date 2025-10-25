import { describe, expect, it } from 'vitest';
import { normalizePath } from '../src/lib/normalizePath';

describe('normalizePath', () => {
  describe('basic functionality', () => {
    it('should normalize a simple path', () => {
      expect(normalizePath('/foo/bar')).toBe('/foo/bar');
    });

    it('should normalize path without leading slash', () => {
      expect(normalizePath('foo/bar')).toBe('/foo/bar');
    });

    it('should handle root path', () => {
      expect(normalizePath('/')).toBe('/');
    });

    it('should handle empty string as root', () => {
      expect(normalizePath('')).toBe('/');
    });
  });

  describe('path with dots', () => {
    it('should remove single dots', () => {
      expect(normalizePath('/foo/./bar')).toBe('/foo/bar');
    });

    it('should handle multiple single dots', () => {
      expect(normalizePath('/foo/./././bar')).toBe('/foo/bar');
    });

    it('should handle double dots (parent directory)', () => {
      expect(normalizePath('/foo/bar/..')).toBe('/foo');
    });

    it('should handle multiple double dots', () => {
      expect(normalizePath('/foo/bar/baz/../..')).toBe('/foo');
    });

    it('should handle double dots in the middle', () => {
      expect(normalizePath('/foo/bar/../baz')).toBe('/foo/baz');
    });

    it('should handle double dots going beyond root', () => {
      expect(normalizePath('/../foo')).toBe('/foo');
    });

    it('should handle complex path with mixed dots', () => {
      expect(normalizePath('/foo/./bar/../baz/./qux')).toBe('/foo/baz/qux');
    });
  });

  describe('multiple slashes', () => {
    it('should remove double slashes', () => {
      expect(normalizePath('/foo//bar')).toBe('/foo/bar');
    });

    it('should remove multiple slashes', () => {
      expect(normalizePath('/foo///bar////baz')).toBe('/foo/bar/baz');
    });

    it('should handle trailing slash', () => {
      expect(normalizePath('/foo/bar/')).toBe('/foo/bar');
    });

    it('should handle multiple trailing slashes', () => {
      expect(normalizePath('/foo/bar///')).toBe('/foo/bar');
    });
  });

  describe('edge cases', () => {
    it('should handle path with only dots', () => {
      expect(normalizePath('.')).toBe('/');
    });

    it('should handle path with only double dots', () => {
      expect(normalizePath('..')).toBe('/');
    });

    it('should handle path with only slashes', () => {
      expect(normalizePath('///')).toBe('/');
    });

    it('should handle complex nested path', () => {
      expect(normalizePath('/a/b/c/../../d/e/../f')).toBe('/a/d/f');
    });

    it('should handle path with spaces in directory names', () => {
      expect(normalizePath('/foo bar/baz')).toBe('/foo bar/baz');
    });

    it('should handle path with special characters', () => {
      expect(normalizePath('/foo-bar/baz_qux')).toBe('/foo-bar/baz_qux');
    });

    it('should handle very long path', () => {
      const longPath = '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p';
      expect(normalizePath(longPath)).toBe(longPath);
    });

    it('should handle path with Unicode characters', () => {
      expect(normalizePath('/foo/日本語/bar')).toBe('/foo/日本語/bar');
    });
  });

  describe('combined scenarios', () => {
    it('should normalize complex real-world path', () => {
      expect(normalizePath('//foo//./bar/../baz/./qux//')).toBe('/foo/baz/qux');
    });

    it('should handle alternating dots and slashes', () => {
      expect(normalizePath('/./././')).toBe('/');
    });

    it('should handle path going up and down', () => {
      expect(normalizePath('/a/b/../c/d/../e')).toBe('/a/c/e');
    });

    it('should normalize relative-looking path to absolute', () => {
      expect(normalizePath('a/b/c')).toBe('/a/b/c');
    });
  });
});
