import { describe, expect, test } from 'vitest';
import { negative, positive } from './positive';

describe('positive', () => {
  test('should return an empty array for positive numbers', () => {
    let result = positive()(1);
    expect(result).toEqual([]);
  });

  test('should return an error object for non-positive numbers', () => {
    let result = positive()(-1);
    expect(result).toEqual([
      {
        code: 'invalid_positive',
        message: 'Invalid positive, expected -1',
        received: -1,
        positive: true
      }
    ]);
  });

  test('should use the custom error message if provided', () => {
    let result = positive({ message: 'Value must be positive' })(-1);
    expect(result).toEqual([
      {
        code: 'invalid_positive',
        message: 'Value must be positive',
        received: -1,
        positive: true
      }
    ]);
  });
});

describe('negative', () => {
  test('should return an empty array for negative numbers', () => {
    let result = negative()(-1);
    expect(result).toEqual([]);
  });

  test('should return an error object for non-negative numbers', () => {
    let result = negative()(1);
    expect(result).toEqual([
      {
        code: 'invalid_negative',
        message: 'Invalid negative, expected 1',
        received: 1,
        negative: true
      }
    ]);
  });

  test('should use the custom error message if provided', () => {
    let result = negative({ message: 'Value must be negative' })(1);
    expect(result).toEqual([
      {
        code: 'invalid_negative',
        message: 'Value must be negative',
        received: 1,
        negative: true
      }
    ]);
  });
});
