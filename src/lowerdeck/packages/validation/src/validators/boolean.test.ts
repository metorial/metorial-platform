import { describe, expect, test } from 'vitest';
import { boolean } from './boolean';

describe('boolean validator', () => {
  test('should return success for a boolean value', () => {
    let result = boolean({}).validate(true);
    expect(result).toEqual({ success: true, value: true });
  });

  test('should return an error for a non-boolean value', () => {
    let result = boolean({}).validate('not a boolean');
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Invalid input, expected a boolean, received string',
          received: 'string',
          expected: 'boolean'
        }
      ]
    });
  });

  test('should return a custom error message if provided', () => {
    let result = boolean({ message: 'Custom error message' }).validate('not a boolean');
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Custom error message',
          received: 'string',
          expected: 'boolean'
        }
      ]
    });
  });
});
