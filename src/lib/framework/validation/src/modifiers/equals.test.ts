import { describe, expect, test } from 'vitest';
import { equals, notEquals } from './equals';

describe('equals', () => {
  test('returns an empty array if the value equals the expected value', () => {
    let validator = equals('hello');
    let result = validator('hello');
    expect(result).toEqual([]);
  });

  test('returns an error object if the value does not equal the expected value', () => {
    let validator = equals('hello');
    let result = validator('world');
    expect(result).toEqual([
      {
        code: 'invalid_equals',
        message: 'Invalid value, expected hello',
        expected: 'hello',
        received: 'world'
      }
    ]);
  });

  test('uses the custom error message if provided', () => {
    let validator = equals('hello', { message: 'This is a custom error message' });
    let result = validator('world');
    expect(result).toEqual([
      {
        code: 'invalid_equals',
        message: 'This is a custom error message',
        expected: 'hello',
        received: 'world'
      }
    ]);
  });
});

describe('notEquals', () => {
  test('returns an empty array if the value does not equal the expected value', () => {
    let validator = notEquals('hello');
    let result = validator('world');
    expect(result).toEqual([]);
  });

  test('returns an error object if the value equals the expected value', () => {
    let validator = notEquals('hello');
    let result = validator('hello');
    expect(result).toEqual([
      {
        code: 'invalid_not_equals',
        message: 'Invalid value, expected not hello',
        expected: 'hello',
        received: 'hello'
      }
    ]);
  });

  test('uses the custom error message if provided', () => {
    let validator = notEquals('hello', { message: 'This is a custom error message' });
    let result = validator('hello');
    expect(result).toEqual([
      {
        code: 'invalid_not_equals',
        message: 'This is a custom error message',
        expected: 'hello',
        received: 'hello'
      }
    ]);
  });
});
