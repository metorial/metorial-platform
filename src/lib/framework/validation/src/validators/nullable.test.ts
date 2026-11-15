import { describe, expect, test } from 'vitest';
import { nullable } from './nullable';
import { string } from './string';

describe('nullable', () => {
  test('should return a validator that allows null values', () => {
    let validator = nullable(string());

    expect(validator.validate(null)).toEqual({ success: true, value: null });
  });

  test('should return a validator that delegates to the input validator for non-null values', () => {
    let validator = nullable(string());

    expect(validator.validate('hello')).toEqual({ success: true, value: 'hello' });
    expect(validator.validate(42)).toEqual({
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

  test('should return a validator with the correct type and optional flag', () => {
    let validator = nullable(string());

    expect(validator.type).toBe('string');
  });
});
