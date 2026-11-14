import { describe, expect, test } from 'vitest';
import { color } from './color';

describe('color', () => {
  test('returns an empty array for a valid color', () => {
    let result = color()('#FF0000');
    expect(result).toEqual([]);
  });

  test('returns an error object for an invalid color', () => {
    let result = color()('not_a_color');
    expect(result).toEqual([
      {
        code: 'invalid_color',
        message: 'Invalid color'
      }
    ]);
  });

  test('returns a custom error message if provided', () => {
    let result = color({ message: 'Custom error message' })('not_a_color');
    expect(result).toEqual([
      {
        code: 'invalid_color',
        message: 'Custom error message'
      }
    ]);
  });
});
