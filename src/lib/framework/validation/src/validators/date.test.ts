import { describe, expect, test } from 'vitest';
import { date } from './date';

describe('date', () => {
  test('should return success for a valid date', () => {
    let input = new Date();
    let result: any = date().validate(input);
    expect(result.success).toBe(true);
    expect(result.value).toBe(input);
  });

  test('should return an error for an invalid date', () => {
    let input = 'not a date';
    let result: any = date().validate(input);
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        code: 'invalid_type',
        message: 'Invalid input, expected a date, received string',
        received: 'string',
        expected: 'date'
      }
    ]);
  });

  test('should allow custom error messages', () => {
    let input = 'not a date';
    let result: any = date({ message: 'Custom error message' }).validate(input);
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        code: 'invalid_type',
        message: 'Custom error message',
        received: 'string',
        expected: 'date'
      }
    ]);
  });
});
