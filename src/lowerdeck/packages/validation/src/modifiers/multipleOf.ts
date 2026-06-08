import { ValidationModifier } from '../lib/types';

export let multipleOf =
  (multi: number, opts?: { message?: string }): ValidationModifier<number> =>
  value => {
    if (value % multi !== 0) {
      return [
        {
          code: 'invalid_multiple_of',
          message: opts?.message ?? `Invalid multiple of ${multi}, expected ${value}`,
          received: value,
          multipleOf: multi
        }
      ];
    }

    return [];
  };
