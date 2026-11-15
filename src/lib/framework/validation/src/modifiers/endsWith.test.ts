import { describe, expect, test } from 'vitest';
import { endsWith } from './endsWith';

describe('endsWith', () => {
  test('returns an empty array if the value ends with the suffix', () => {
    let suffix = 'world';
    let validate = endsWith(suffix);

    expect(validate('hello world')).toEqual([]);
    expect(validate('goodbye world')).toEqual([]);
  });

  test('returns an error object if the value does not end with the suffix', () => {
    let suffix = 'world';
    let validate = endsWith(suffix);

    expect(validate('hello')).toEqual([
      {
        code: 'invalid_suffix',
        message: `Invalid suffix, expected ${suffix}`,
        expected: suffix,
        received: 'hello'
      }
    ]);

    expect(validate('goodbye')).toEqual([
      {
        code: 'invalid_suffix',
        message: `Invalid suffix, expected ${suffix}`,
        expected: suffix,
        received: 'goodbye'
      }
    ]);
  });

  test('uses the provided error message if one is given', () => {
    let suffix = 'world';
    let message = 'This value must end with "world"';
    let validate = endsWith(suffix, { message });

    expect(validate('hello')).toEqual([
      {
        code: 'invalid_suffix',
        message,
        expected: suffix,
        received: 'hello'
      }
    ]);
  });
});
