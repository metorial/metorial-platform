import { describe, expect, test } from 'vitest';
import { integer } from './integer';

describe('integer', () => {
  test('should return an empty array if the value is an integer', () => {
    let result = integer()(42);
    expect(result).toEqual([]);
  });

  test('should return an error object if the value is not an integer', () => {
    let result = integer()(0.42);
    expect(result).toEqual([
      {
        code: 'invalid_integer',
        message: 'Invalid value, expected integer',
        expected: 0.42,
        received: 0.42
      }
    ]);
  });

  test('should return an error object if the value is not an integer', () => {
    let result = integer()('not an integer' as any);
    expect(result).toEqual([
      {
        code: 'invalid_integer',
        message: 'Invalid value, expected integer',
        expected: 'not an integer',
        received: 'not an integer'
      }
    ]);
  });

  test('should use the provided error message if one is provided', () => {
    let result = integer({ message: 'Custom error message' })('not an integer' as any);
    expect(result).toEqual([
      {
        code: 'invalid_integer',
        message: 'Custom error message',
        expected: 'not an integer',
        received: 'not an integer'
      }
    ]);
  });
});
