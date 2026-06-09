import { describe, expect, test } from 'vitest';
import { length, maxLength, minLength } from './length';

describe('length', () => {
  test('returns an empty array if the value has the expected length', () => {
    let validator = length(5);
    let result = validator('hello');
    expect(result).toEqual([]);
  });

  test('returns an error object if the value does not have the expected length', () => {
    let validator = length(5);
    let result = validator('longer');
    expect(result).toEqual([
      {
        code: 'invalid_length',
        message: 'Invalid length, expected 5',
        expected: 5,
        received: 6
      }
    ]);
  });
});

describe('minLength', () => {
  test('returns an empty array if the value has the minimum length', () => {
    let validator = minLength(5);
    let result = validator('hello');
    expect(result).toEqual([]);
  });

  test('returns an empty array if the value is longer than the minimum length', () => {
    let validator = minLength(5);
    let result = validator('world');
    expect(result).toEqual([]);
  });

  test('returns an error object if the value is shorter than the minimum length', () => {
    let validator = minLength(5);
    let result = validator('hi');
    expect(result).toEqual([
      {
        code: 'invalid_min_length',
        message: 'Invalid min length, expected 5',
        expected: 5,
        received: 2,
        min: 5
      }
    ]);
  });

  test('uses the custom error message if provided', () => {
    let validator = minLength(5, { message: 'Too short!' });
    let result = validator('hi');
    expect(result).toEqual([
      {
        code: 'invalid_min_length',
        message: 'Too short!',
        expected: 5,
        received: 2,
        min: 5
      }
    ]);
  });
});

describe('maxLength', () => {
  test('returns an empty array if the value has the maximum length', () => {
    let validator = maxLength(5);
    let result = validator('hello');
    expect(result).toEqual([]);
  });

  test('returns an empty array if the value is shorter than the maximum length', () => {
    let validator = maxLength(5);
    let result = validator('hi');
    expect(result).toEqual([]);
  });

  test('returns an error object if the value is longer than the maximum length', () => {
    let validator = maxLength(5);
    let result = validator('longer');
    expect(result).toEqual([
      {
        code: 'invalid_max_length',
        message: 'Invalid max length, expected 5',
        expected: 5,
        received: 6,
        max: 5
      }
    ]);
  });

  test('uses the custom error message if provided', () => {
    let validator = maxLength(5, { message: 'Too long!' });
    let result = validator('longer');
    expect(result).toEqual([
      {
        code: 'invalid_max_length',
        message: 'Too long!',
        expected: 5,
        received: 6,
        max: 5
      }
    ]);
  });
});
