import { describe, expect, it } from 'vitest';
import { clamp } from '../clamp';

describe('clamp', () => {
  it.concurrent.each([
    ['within range', 5, { min: 0, max: 10 }, 5],
    ['below min', -5, { min: 0, max: 10 }, 0],
    ['above max', 15, { min: 0, max: 10 }, 10],
    ['at min boundary', 0, { min: 0, max: 10 }, 0],
    ['at max boundary', 10, { min: 0, max: 10 }, 10],
    ['negative range within', -5, { min: -10, max: -1 }, -5],
    ['negative range below', -15, { min: -10, max: -1 }, -10],
    ['negative range above', 0, { min: -10, max: -1 }, -1]
  ])('%s', (_label, value, range, expected) => {
    expect(clamp(value, range)).toBe(expected);
  });
});
