import { describe, expect, test } from 'vitest';
import { oneOf } from './oneOf';

describe('oneOf', () => {
  test('should return an empty array if the value is one of the allowed values', () => {
    let allowed = ['apple', 'banana', 'orange'];
    let modifier = oneOf(allowed);
    let value = 'banana';
    let result = modifier(value);
    expect(result).toEqual([]);
  });

  test('should return an error object if the value is not one of the allowed values', () => {
    let allowed = ['apple', 'banana', 'orange'];
    let modifier = oneOf(allowed);
    let value = 'grape';
    let result = modifier(value);
    expect(result).toEqual([
      {
        code: 'invalid_value',
        message: 'Value must be one of: apple, banana, orange'
      }
    ]);
  });

  // Add more test cases if needed
});
