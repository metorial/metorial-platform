import { describe, expect, test } from 'vitest';
import { bigint } from './bigint';

describe('bigint', () => {
  test('should return success for a valid bigint', () => {
    let result = bigint({}).validate(42n);
    expect(result).toEqual({ success: true, value: 42n });
  });

  test('should return an error for an invalid bigint', () => {
    let result = bigint({}).validate(42);
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Invalid input, expected bigint, received number',
          received: 'number',
          expected: 'bigint'
        }
      ]
    });
  });

  test('should use the provided error message', () => {
    let result = bigint({ message: 'Custom error message' }).validate(42);
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Custom error message',
          received: 'number',
          expected: 'bigint'
        }
      ]
    });
  });
});
