import { describe, expect, it } from 'vitest';
import { randomFromArray } from './index';

describe('randomFromArray', () => {
  it('should return null for an empty array', () => {
    const input: number[] = [];
    const output = randomFromArray(input);
    expect(output).toBeNull();
  });

  it('should return an element from the array', () => {
    const input = [1, 2, 3, 4, 5];
    const output = randomFromArray(input);
    expect(input).toContain(output);
  });

  it('should work with strings', () => {
    const input = ['a', 'b', 'c', 'd'];
    const output = randomFromArray(input);
    expect(input).toContain(output);
  });

  it('should work with mixed types', () => {
    const input = [1, 'a', true, null];
    const output = randomFromArray(input);
    expect(input).toContain(output);
  });

  it('should return the only element if the array has one element', () => {
    const input = [42];
    const output = randomFromArray(input);
    expect(output).toBe(42);
  });
});
