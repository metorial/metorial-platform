import { describe, expect, test } from 'vitest';
import { randomNumber } from './randomNumber';

describe('randomNumber', () => {
  test('should return a random number within the specified range', () => {
    const min = 1;
    const max = 10;

    const result = randomNumber(min, max);

    expect(result).toBeGreaterThanOrEqual(min);
    expect(result).toBeLessThanOrEqual(max);
  });

  test('should return the minimum value when min and max are the same', () => {
    const min = 5;
    const max = 5;

    const result = randomNumber(min, max);

    expect(result).toBe(min);
  });

  test('should return a random number when min and max are negative', () => {
    const min = -10;
    const max = -1;

    const result = randomNumber(min, max);

    expect(result).toBeGreaterThanOrEqual(min);
    expect(result).toBeLessThanOrEqual(max);
  });
});
