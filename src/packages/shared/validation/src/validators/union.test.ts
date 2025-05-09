import { describe, expect, test } from 'vitest';
import { error, success } from '../lib/result';
import { array, number, object, string } from './index';
import { union } from './union';

describe('union', () => {
  test('should validate a string', () => {
    let validator = union([string(), number()]);

    expect(validator.validate('hello')).toEqual(success('hello'));
  });

  test('should validate a number', () => {
    let validator = union([string(), number()]);

    expect(validator.validate(42)).toEqual(success(42));
  });

  test('should not validate an object', () => {
    let validator = union([string(), number()]);

    expect(validator.validate({})).toEqual(
      error([
        {
          code: 'invalid_type',
          message: 'Invalid input, expected string, received object',
          expected: 'string',
          received: 'object'
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Invalid input, expected number, received object',
          received: 'object'
        }
      ])
    );
  });

  test('should validate an array of strings', () => {
    let validator = union([string(), array(string())]);

    expect(validator.validate(['hello', 'world'])).toEqual(success(['hello', 'world']));
  });

  test('should validate an array of numbers', () => {
    let validator = union([number(), array(number())]);

    expect(validator.validate([1, 2, 3])).toEqual(success([1, 2, 3]));
  });

  test('should not validate an array of objects', () => {
    let validator = union([string(), array(object({}))]);

    expect(validator.validate(['hello', {}])).toEqual(
      error([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input, expected string, received object',
          received: 'object'
        },
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Invalid input, expected object, received string',
          path: ['0'],
          received: 'string'
        }
      ])
    );
  });
});
