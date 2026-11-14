import { describe, expect, test } from 'vitest';
import { error, success } from '../lib/result';
import { maxLength, minLength } from '../modifiers/length';
import { array } from './array';
import { number } from './number';
import { object } from './object';
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

  test('should apply maxLength modifier', () => {
    let validator = array(string(), { modifiers: [maxLength(2)] });

    expect(validator.validate(['a', 'b'])).toEqual(success(['a', 'b']));
    expect(validator.validate(['a', 'b', 'c'])).toEqual(
      error([
        {
          code: 'invalid_max_length',
          message: 'Invalid max length, expected 2',
          expected: 2,
          received: 3,
          max: 2
        }
      ])
    );
  });

  test('should apply minLength modifier', () => {
    let validator = array(string(), { modifiers: [minLength(1)] });

    expect(validator.validate(['a'])).toEqual(success(['a']));
    expect(validator.validate([])).toEqual(
      error([
        {
          code: 'invalid_min_length',
          message: 'Invalid min length, expected 1',
          expected: 1,
          received: 0,
          min: 1
        }
      ])
    );
  });

  test('should collect errors from all modifiers', () => {
    let validator = array(string(), {
      modifiers: [
        maxLength(1, { message: 'too many' }),
        value => (value.includes('x') ? [{ code: 'no_x', message: 'no x' }] : [])
      ]
    });

    expect(validator.validate(['a', 'x'])).toEqual(
      error([
        {
          code: 'invalid_max_length',
          message: 'too many',
          expected: 1,
          received: 2,
          max: 1
        },
        { code: 'no_x', message: 'no x' }
      ])
    );
  });

  test('should report item errors with their path before applying modifiers', () => {
    let validator = array(object({ name: string({ modifiers: [maxLength(3)] }) }), {
      modifiers: [maxLength(1)]
    });

    expect(validator.validate([{ name: 'ok' }, { name: 'too long' }])).toEqual(
      error([
        {
          code: 'invalid_max_length',
          message: 'Invalid max length, expected 3',
          expected: 3,
          received: 8,
          max: 3,
          path: ['1', 'name']
        }
      ])
    );
  });

  test('should use the provided error message', () => {
    let validator = array(string(), { message: 'Custom error message' });

    expect(validator.validate('not an array')).toEqual(
      error([
        {
          code: 'invalid_type',
          message: 'Custom error message',
          received: 'string',
          expected: 'array'
        }
      ])
    );
  });

  test('should apply preprocessors and transformers around item validation', () => {
    let validator = array(number(), {
      preprocessors: [value => (typeof value == 'string' ? value.split(',') : value)],
      transformers: [value => [...value].sort((a, b) => a - b)]
    });

    expect(validator.validate('3,1,2')).toEqual(success([1, 2, 3]));
  });

  test('should expose items and examples for introspection', () => {
    let items = string({ examples: ['a'] });

    expect(array(items).items).toBe(items);
    expect(array(items).examples).toEqual([['a', 'a']]);
    expect(array(items, { examples: [['x']] }).examples).toEqual([['x']]);
    expect(array(items, { hidden: true }).hidden).toBe(true);
  });
});
