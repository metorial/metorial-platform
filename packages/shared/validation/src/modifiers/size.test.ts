import { describe, expect, test } from 'vitest';
import { maxValue, minValue } from './size';

describe('minValue', () => {
  test('returns an empty array if the value is greater than or equal to the minimum', () => {
    let min = 5;
    let validate = minValue(min);

    expect(validate(5)).toEqual([]);
    expect(validate(10)).toEqual([]);
  });

  test('returns an array with an error object if the value is less than the minimum', () => {
    let min = 5;
    let validate = minValue(min);

    expect(validate(4)).toEqual([
      {
        code: 'invalid_min',
        message: `Invalid min, expected ${min}`,
        expected: min,
        received: 4,
        min
      }
    ]);
  });

  test('uses the custom error message if provided', () => {
    let min = 5;
    let message = 'Value must be at least 5';
    let validate = minValue(min, { message });

    expect(validate(4)).toEqual([
      {
        code: 'invalid_min',
        message,
        expected: min,
        received: 4,
        min
      }
    ]);
  });
});

describe('maxValue', () => {
  test('returns an empty array if the value is less than or equal to the maximum', () => {
    let max = 10;
    let validate = maxValue(max);

    expect(validate(10)).toEqual([]);
    expect(validate(5)).toEqual([]);
  });

  test('returns an array with an error object if the value is greater than the maximum', () => {
    let max = 10;
    let validate = maxValue(max);

    expect(validate(11)).toEqual([
      {
        code: 'invalid_max',
        message: `Invalid max, expected ${max}`,
        expected: max,
        received: 11,
        max
      }
    ]);
  });

  test('uses the custom error message if provided', () => {
    let max = 10;
    let message = 'Value must be at most 10';
    let validate = maxValue(max, { message });

    expect(validate(11)).toEqual([
      {
        code: 'invalid_max',
        message,
        expected: max,
        received: 11,
        max
      }
    ]);
  });
});
