import { describe, expect, test } from 'vitest';
import { optional } from './optional';
import { string } from './string';

describe('optional', () => {
  test('should return a new validator with optional values', () => {
    let validator = optional(string());

    expect(validator.type).toBe('string');
    expect(validator.optional).toBe(true);

    expect(validator.validate(undefined)).toEqual({ success: true, value: undefined });
    expect(validator.validate('hello')).toEqual({ success: true, value: 'hello' });
  });

  test('should pass through the validation result of the original validator', () => {
    let validator = optional(string());

    expect(validator.validate(undefined)).toEqual({ success: true, value: undefined });
    expect(validator.validate('hello')).toEqual({ success: true, value: 'hello' });
    expect(validator.validate(123)).toEqual({
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
});
