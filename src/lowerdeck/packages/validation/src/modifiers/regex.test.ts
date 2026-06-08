import { describe, expect, test } from 'vitest';
import { regex } from './regex';

describe('regex', () => {
  test('returns an empty array if the value matches the pattern', () => {
    let pattern = /^[a-z]+$/;
    let validate = regex(pattern);
    let result = validate('hello');

    expect(result).toEqual([]);
  });

  test('returns an error object if the value does not match the pattern', () => {
    let pattern = /^[a-z]+$/;
    let validate = regex(pattern);
    let result = validate('123');

    expect(result).toEqual([
      {
        code: 'invalid_regex',
        message: 'Invalid regex, expected /^[a-z]+$/',
        received: '123'
      }
    ]);
  });

  test('uses the custom error message if provided', () => {
    let pattern = /^[a-z]+$/;
    let validate = regex(pattern, { message: 'Must be all lowercase letters' });
    let result = validate('123');

    expect(result).toEqual([
      {
        code: 'invalid_regex',
        message: 'Must be all lowercase letters',
        received: '123'
      }
    ]);
  });
});
