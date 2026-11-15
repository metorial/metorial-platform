import { describe, expect, test } from 'vitest';
import { multipleOf } from './multipleOf';

describe('multipleOf', () => {
  test('should return an empty array if the value is a multiple of the given number', () => {
    const modifier = multipleOf(3);
    expect(modifier(9)).toEqual([]);
    expect(modifier(12)).toEqual([]);
    expect(modifier(0)).toEqual([]);
  });

  test('should return an error object if the value is not a multiple of the given number', () => {
    const modifier = multipleOf(5);
    expect(modifier(7)).toEqual([
      {
        code: 'invalid_multiple_of',
        message: 'Invalid multiple of 5, expected 7',
        received: 7,
        multipleOf: 5
      }
    ]);
    expect(modifier(11)).toEqual([
      {
        code: 'invalid_multiple_of',
        message: 'Invalid multiple of 5, expected 11',
        received: 11,
        multipleOf: 5
      }
    ]);
  });

  test('should allow custom error message', () => {
    const modifier = multipleOf(2, { message: 'Value must be an even number' });
    expect(modifier(3)).toEqual([
      {
        code: 'invalid_multiple_of',
        message: 'Value must be an even number',
        received: 3,
        multipleOf: 2
      }
    ]);
    expect(modifier(5)).toEqual([
      {
        code: 'invalid_multiple_of',
        message: 'Value must be an even number',
        received: 5,
        multipleOf: 2
      }
    ]);
  });
});
