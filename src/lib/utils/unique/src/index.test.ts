import { describe, expect, it } from 'vitest';
import { unique } from './index';

describe('unique', () => {
  it('should return an array with unique elements', () => {
    const input = [1, 2, 2, 3, 4, 4, 5];
    const output = unique(input);
    expect(output).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle an empty array', () => {
    const input: number[] = [];
    const output = unique(input);
    expect(output).toEqual([]);
  });

  it('should handle an array with all unique elements', () => {
    const input = [1, 2, 3, 4, 5];
    const output = unique(input);
    expect(output).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle an array with all duplicate elements', () => {
    const input = [1, 1, 1, 1];
    const output = unique(input);
    expect(output).toEqual([1]);
  });

  it('should work with strings', () => {
    const input = ['a', 'b', 'b', 'c', 'a'];
    const output = unique(input);
    expect(output).toEqual(['a', 'b', 'c']);
  });

  it('should work with mixed types', () => {
    const input = [1, '1', 2, '2', 1, '1'];
    const output = unique(input);
    expect(output).toEqual([1, '1', 2, '2']);
  });
});
