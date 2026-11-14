import { describe, expect, test } from 'vitest';
import { nullValue } from './null';

describe('null', () => {
  test('should return success for valid null', () => {
    let result = nullValue({}).validate(null);
    expect(result).toEqual({ success: true, value: null });
  });

  test('should return an error for an invalid null', () => {
    let result = nullValue({}).validate('not a null');
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Invalid input, expected null, received string',
          received: 'string',
          expected: 'null'
        }
      ]
    });
  });

  test('should use the provided error message', () => {
    let result = nullValue({ message: 'Custom error message' }).validate('not a null');
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Custom error message',
          received: 'string',
          expected: 'null'
        }
      ]
    });
  });
});
