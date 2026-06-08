import { describe, expect, test } from 'vitest';
import { number } from './number';
import { object } from './object';
import { string } from './string';

describe('object', () => {
  test('should validate an object with the correct shape', () => {
    let validator = object({
      name: string(),
      age: number()
    });

    let result: any = validator.validate({
      name: 'John Doe',
      age: 42
    });

    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      name: 'John Doe',
      age: 42
    });
  });

  test('should return an error for an object with an invalid shape', () => {
    let validator = object({
      name: string(),
      age: number()
    });

    let result: any = validator.validate({
      name: 'John Doe',
      age: 'Test'
    });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        code: 'invalid_type',
        message: 'Invalid input, expected number, received string',
        received: 'string',
        expected: 'number',
        path: ['age']
      }
    ]);
  });

  test('should return an error for a non-object input', () => {
    let validator = object({
      name: string(),
      age: number()
    });

    let result: any = validator.validate('not an object');

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        code: 'invalid_type',
        message: 'Invalid input, expected object, received string',
        received: 'string',
        expected: 'object'
      }
    ]);
  });
});
