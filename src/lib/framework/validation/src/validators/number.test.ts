import { describe, expect, test } from 'vitest';
import { integer } from '../modifiers/integer';
import { number } from './number';

describe('number', () => {
  test('should apply modifiers to a number parsed from a string', () => {
    expect(number({ modifiers: [integer()] }).validate('2')).toEqual({
      success: true,
      value: 2
    });
    expect(number({ modifiers: [integer()] }).validate('2.5').success).toBe(false);
  });

  test('should return success for a valid number', () => {
    let result = number({}).validate(42);
    expect(result).toEqual({ success: true, value: 42 });
  });

  test('should return an error for an invalid number', () => {
    let result = number({}).validate('not a number');
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Invalid input, expected number, received string',
          received: 'string',
          expected: 'number'
        }
      ]
    });
  });

  test('should use the provided error message', () => {
    let result = number({ message: 'Custom error message' }).validate('not a number');
    expect(result).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Custom error message',
          received: 'string',
          expected: 'number'
        }
      ]
    });
  });
});
