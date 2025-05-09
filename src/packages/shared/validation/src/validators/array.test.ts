import { describe, expect, test } from 'vitest';
import { error, success } from '../lib/result';
import { array } from './array';
import { string } from './string';

describe('array', () => {
  test('should validate an array of strings', () => {
    let validator = array(string());
    let result = validator.validate(['hello', 'world']);

    expect(result).toEqual(success(['hello', 'world']));
  });

  test('should return an error for invalid input', () => {
    let validator = array(string());
    let result = validator.validate('not an array');

    expect(result).toEqual(
      error([
        {
          code: 'invalid_type',
          message: 'Invalid input, expected array, received string',
          received: 'string',
          expected: 'array'
        }
      ])
    );
  });

  test('should return an error for invalid array items', () => {
    let validator = array(string());
    let result = validator.validate(['hello', 123]);

    expect(result).toEqual(
      error([
        {
          code: 'invalid_type',
          message: 'Invalid input, expected string, received number',
          received: 'number',
          expected: 'string',
          path: ['1']
        }
      ])
    );
  });
});
