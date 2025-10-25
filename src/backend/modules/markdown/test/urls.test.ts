import { describe, expect, it } from 'vitest';
import { isAbsoluteUrl, isRelativeUrl, joinPath, joinUrls } from '../src/lib/urls';

describe('isAbsoluteUrl', () => {
  it('should return true for valid HTTP URLs', () => {
    expect(isAbsoluteUrl('http://example.com')).toBe(true);
    expect(isAbsoluteUrl('https://example.com')).toBe(true);
    expect(isAbsoluteUrl('https://example.com/path')).toBe(true);
    expect(isAbsoluteUrl('https://example.com/path?query=value')).toBe(true);
  });

  it('should return true for other valid protocols', () => {
    expect(isAbsoluteUrl('ftp://example.com')).toBe(true);
    expect(isAbsoluteUrl('file:///path/to/file')).toBe(true);
    expect(isAbsoluteUrl('mailto:test@example.com')).toBe(true);
  });

  it('should return false for relative URLs', () => {
    expect(isAbsoluteUrl('/path/to/file')).toBe(false);
    expect(isAbsoluteUrl('./relative/path')).toBe(false);
    expect(isAbsoluteUrl('../parent/path')).toBe(false);
    expect(isAbsoluteUrl('relative/path')).toBe(false);
  });

  it('should return false for fragments', () => {
    expect(isAbsoluteUrl('#anchor')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isAbsoluteUrl('')).toBe(false);
    expect(isAbsoluteUrl('not-a-url')).toBe(false);
    expect(isAbsoluteUrl('://invalid')).toBe(false);
  });
});

describe('isRelativeUrl', () => {
  it('should return true for relative paths', () => {
    expect(isRelativeUrl('/path/to/file')).toBe(true);
    expect(isRelativeUrl('./relative/path')).toBe(true);
    expect(isRelativeUrl('../parent/path')).toBe(true);
    expect(isRelativeUrl('relative/path')).toBe(true);
    expect(isRelativeUrl('file.txt')).toBe(true);
  });

  it('should return false for absolute HTTP URLs', () => {
    expect(isRelativeUrl('http://example.com')).toBe(false);
    expect(isRelativeUrl('https://example.com')).toBe(false);
    expect(isRelativeUrl('https://example.com/path')).toBe(false);
  });

  it('should return false for fragments', () => {
    expect(isRelativeUrl('#anchor')).toBe(false);
  });

  it('should handle edge cases', () => {
    // Empty string returns falsy value (empty string itself from the && operator)
    expect(isRelativeUrl('')).toBeFalsy();
    expect(isRelativeUrl('ftp://example.com')).toBe(true); // Not http/https, so considered relative by the function
  });
});

describe('joinPath', () => {
  it('should join simple paths', () => {
    expect(joinPath('https://example.com', 'path')).toBe('https://example.com/path');
    expect(joinPath('https://example.com/', 'path')).toBe('https://example.com/path');
    expect(joinPath('https://example.com/base', 'path')).toBe('https://example.com/base/path');
  });

  it('should handle multiple path segments', () => {
    expect(joinPath('https://example.com', 'path/to/file')).toBe('https://example.com/path/to/file');
    expect(joinPath('https://example.com/base', 'path/to/file')).toBe('https://example.com/base/path/to/file');
  });

  it('should handle parent directory references (..)', () => {
    expect(joinPath('https://example.com/a/b', '../c')).toBe('https://example.com/a/c');
    expect(joinPath('https://example.com/a/b/c', '../../d')).toBe('https://example.com/a/d');
    expect(joinPath('https://example.com/a/b', '..')).toBe('https://example.com/a');
  });

  it('should handle current directory references (.)', () => {
    expect(joinPath('https://example.com/a', './b')).toBe('https://example.com/a/b');
    expect(joinPath('https://example.com/a', '.')).toBe('https://example.com/a');
  });

  it('should preserve query strings and hashes', () => {
    expect(joinPath('https://example.com?query=1', 'path')).toBe('https://example.com/path?query=1');
    expect(joinPath('https://example.com#hash', 'path')).toBe('https://example.com/path#hash');
    expect(joinPath('https://example.com?query=1#hash', 'path')).toBe('https://example.com/path?query=1#hash');
  });

  it('should handle leading slashes', () => {
    expect(joinPath('https://example.com', '/path')).toBe('https://example.com/path');
    expect(joinPath('https://example.com/base', '/path')).toBe('https://example.com/base/path');
  });

  it('should handle empty path segments', () => {
    expect(joinPath('https://example.com', 'path//to///file')).toBe('https://example.com/path/to/file');
  });

  it('should handle complex path navigation', () => {
    expect(joinPath('https://example.com/a/b/c', '../d/./e/../f')).toBe('https://example.com/a/b/d/f');
  });
});

describe('joinUrls', () => {
  it('should join base URL with single path', () => {
    expect(joinUrls('https://example.com', 'path')).toBe('https://example.com/path');
    expect(joinUrls('https://example.com/', 'path')).toBe('https://example.com/path');
  });

  it('should join base URL with multiple paths', () => {
    expect(joinUrls('https://example.com', 'a', 'b', 'c')).toBe('https://example.com/a/b/c');
    expect(joinUrls('https://example.com/base', 'path1', 'path2')).toBe('https://example.com/base/path1/path2');
  });

  it('should replace with absolute URLs in the chain', () => {
    expect(joinUrls('https://example.com', 'path', 'https://newsite.com')).toBe('https://newsite.com');
    expect(joinUrls('https://example.com', 'https://newsite.com', 'path')).toBe('https://newsite.com/path');
  });

  it('should append fragments', () => {
    expect(joinUrls('https://example.com/path', '#anchor')).toBe('https://example.com/path#anchor');
    expect(joinUrls('https://example.com', 'path', '#anchor')).toBe('https://example.com/path#anchor');
  });

  it('should skip undefined and empty paths', () => {
    expect(joinUrls('https://example.com', undefined, 'path', undefined)).toBe('https://example.com/path');
    expect(joinUrls('https://example.com', '', 'path')).toBe('https://example.com/path');
  });

  it('should handle complex scenarios', () => {
    expect(joinUrls('https://example.com', 'a/b', '../c', 'd')).toBe('https://example.com/a/c/d');
    expect(joinUrls('https://example.com/base', undefined, 'path', '#section')).toBe('https://example.com/base/path#section');
  });

  it('should handle parent directory navigation', () => {
    expect(joinUrls('https://example.com/a/b', '..', 'c')).toBe('https://example.com/a/c');
    expect(joinUrls('https://example.com/a/b/c', '../..', 'd')).toBe('https://example.com/a/d');
  });

  it('should preserve query strings', () => {
    expect(joinUrls('https://example.com?query=1', 'path')).toBe('https://example.com/path?query=1');
  });

  it('should handle only base URL', () => {
    expect(joinUrls('https://example.com')).toBe('https://example.com');
    expect(joinUrls('https://example.com', undefined, undefined)).toBe('https://example.com');
  });

  it('should handle mixed absolute and relative URLs', () => {
    expect(joinUrls('https://example.com', 'path1', 'https://other.com', 'path2')).toBe('https://other.com/path2');
  });

  it('should handle edge cases with fragments and absolute URLs', () => {
    // Fragment is appended first, then 'more' is added as a path segment
    expect(joinUrls('https://example.com', 'path', '#anchor', 'more')).toBe('https://example.com/path/more#anchor');
  });
});
