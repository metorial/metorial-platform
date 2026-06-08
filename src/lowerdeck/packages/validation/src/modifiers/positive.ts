import { ValidationModifier } from '../lib/types';

export let positive =
  (opts?: { message?: string }): ValidationModifier<number> =>
  value => {
    if (value <= 0) {
      return [
        {
          code: 'invalid_positive',
          message: opts?.message ?? `Invalid positive, expected ${value}`,
          received: value,
          positive: true
        }
      ];
    }

    return [];
  };

export let negative =
  (opts?: { message?: string }): ValidationModifier<number> =>
  value => {
    if (value >= 0) {
      return [
        {
          code: 'invalid_negative',
          message: opts?.message ?? `Invalid negative, expected ${value}`,
          received: value,
          negative: true
        }
      ];
    }

    return [];
  };
