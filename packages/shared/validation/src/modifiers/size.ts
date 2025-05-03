import { ValidationModifier } from '../lib/types';

export let minValue =
  (min: number, opts?: { message?: string }): ValidationModifier<number> =>
  value => {
    if (value < min) {
      return [
        {
          code: 'invalid_min',
          message: opts?.message ?? `Invalid min, expected ${min}`,
          expected: min,
          received: value,
          min
        }
      ];
    }

    return [];
  };

export let maxValue =
  (max: number, opts?: { message?: string }): ValidationModifier<number> =>
  value => {
    if (value > max) {
      return [
        {
          code: 'invalid_max',
          message: opts?.message ?? `Invalid max, expected ${max}`,
          expected: max,
          received: value,
          max
        }
      ];
    }

    return [];
  };
