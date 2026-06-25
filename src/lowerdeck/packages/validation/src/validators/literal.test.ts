import { describe, expect, test } from 'vitest';
import { literal } from './literal';

describe('literal', () => {
  test('should return success when the value matches the literal', () => {
    let validator = literal('foo');
    let result = validator.validate('foo');
    expect(result).toEqual({ success: true, value: 'foo' });
  });

  test('should return an error when the value does not match the literal', () => {
    let validator = literal('foo');
    let result = validator.validate('bar');
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_literal',
          message: 'Invalid input, expected foo, received bar',
          received: 'bar',
          expected: 'foo'
        }
      ]
    });
  });

  test('should use the provided error message', () => {
    let validator = literal('foo', { message: 'Custom error message' });
    let result = validator.validate('bar');
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_literal',
          message: 'Custom error message',
          received: 'bar',
          expected: 'foo'
        }
      ]
    });
  });
});
