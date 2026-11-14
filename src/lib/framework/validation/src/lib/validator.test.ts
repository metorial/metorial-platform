import { describe, expect, test } from 'vitest';
import { createValidator } from './validator';

describe('createValidator', () => {
  test('should validate a string', () => {
    let stringValidator = createValidator<string, any>('string', (opts, value) => {
      if (typeof value !== 'string') {
        return {
          success: false,
          errors: [{ code: 'invalid_type', message: 'Value must be a string' }]
        };
      }

      if (opts.minLength && value.length < opts.minLength) {
        return {
          success: false,
          errors: [
            {
              code: 'min_length',
              message: `Value must be at least ${opts.minLength} characters long`
            }
          ]
        };
      }

      return { success: true, value };
    });

    let result: any = stringValidator({ minLength: 5 }).validate('hello');
    expect(result.success).toBe(true);
    expect(result.value).toBe('hello');

    let result2: any = stringValidator({ minLength: 5 }).validate('hi');
    expect(result2.success).toBe(false);
    expect(result2.errors).toEqual([
      { code: 'min_length', message: 'Value must be at least 5 characters long' }
    ]);
  });

  test('should validate a number', () => {
    let numberValidator = createValidator<number, any>('number', (opts, value) => {
      if (typeof value !== 'number') {
        return {
          success: false,
          errors: [{ code: 'invalid_type', message: 'Value must be a number' }]
        };
      }

      if (opts.min && value < opts.min) {
        return {
          success: false,
          errors: [{ code: 'min_value', message: `Value must be at least ${opts.min}` }]
        };
      }

      return { success: true, value };
    });

    let result: any = numberValidator({ min: 5 }).validate(10);
    expect(result.success).toBe(true);
    expect(result.value).toBe(10);

    let result2: any = numberValidator({ min: 5 }).validate(3);
    expect(result2.success).toBe(false);
    expect(result2.errors).toEqual([
      { code: 'min_value', message: 'Value must be at least 5' }
    ]);
  });

  test('should handle throwing errors', () => {
    let throwingValidator = createValidator<string, any>('throwing', () => {
      throw new Error('Something went wrong');
    });

    let result: any = throwingValidator().validate('hello');

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      { code: 'invalid_type', message: 'Unable to validate value' }
    ]);
  });
});
