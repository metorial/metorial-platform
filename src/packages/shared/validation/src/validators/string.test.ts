import { describe, expect, test } from 'vitest';
import { string } from './string';

describe('string', () => {
  test('should return success when given a string', () => {
    let result = string({}).validate('hello');
    expect(result).toEqual({ success: true, value: 'hello' });
  });

  test('should return an error when given a non-string value', () => {
    let result = string({}).validate(123);
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Invalid input, expected string, received number',
          received: 'number',
          expected: 'string'
        }
      ]
    });
  });

  test('should use the provided error message', () => {
    let result = string({ message: 'Custom error message' }).validate(123);
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Custom error message',
          received: 'number',
          expected: 'string'
        }
      ]
    });
  });
});
