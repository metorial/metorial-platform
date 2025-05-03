import { describe, expect, test } from 'vitest';
import { number } from './number';
import { record } from './record';
import { string } from './string';

describe('record', () => {
  test('should validate an empty object', () => {
    let validator = record(string());
    let result: any = validator.validate({});
    expect(result.success).toBe(true);
    expect(result.value).toEqual({});
  });

  test('should validate an object with string keys and string values', () => {
    let validator = record(string());
    let result: any = validator.validate({ foo: 'bar', baz: 'qux' });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({ foo: 'bar', baz: 'qux' });
  });

  test('should validate an object with string keys and number values', () => {
    let validator = record(number());
    let result: any = validator.validate({ foo: 1, bar: 2 });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({ foo: 1, bar: 2 });
  });

  test('should fail to validate a non-object', () => {
    let validator = record(string());
    let result: any = validator.validate('not an object');
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        code: 'invalid_type',
        message: 'Invalid input, expected object',
        received: 'not an object',
        expected: 'object'
      }
    ]);
  });

  test('should fail to validate an object with invalid values', () => {
    let validator = record(string());
    let result: any = validator.validate({ foo: 'bar', baz: 123 });
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        code: 'invalid_type',
        message: 'Invalid input, expected string, received number',
        received: 'number',
        expected: 'string',
        path: ['baz']
      }
    ]);
  });
});
