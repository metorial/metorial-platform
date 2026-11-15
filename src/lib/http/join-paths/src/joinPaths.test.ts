import { describe, expect, test } from 'vitest';
import { joinPaths } from './joinPaths';

describe('joinPaths', () => {
  test('should join paths with leading and trailing slashes', () => {
    const result = joinPaths('/path1/', '/path2/');

    expect(result).toBe('/path1/path2');
  });

  test('should join paths without leading and trailing slashes', () => {
    const result = joinPaths('path1', 'path2');

    expect(result).toBe('/path1/path2');
  });

  test('should join paths with empty strings', () => {
    const result = joinPaths('', 'path2', '');

    expect(result).toBe('/path2');
  });

  test('should join multiple paths', () => {
    const result = joinPaths('path1', 'path2', 'path3');

    expect(result).toBe('/path1/path2/path3');
  });
});
