import { ValidationModifier } from '../lib/types';

export let integer =
  (opts?: { message?: string }): ValidationModifier<number> =>
  value => {
    if (!Number.isInteger(value)) {
      return [
        {
          code: 'invalid_integer',
          message: opts?.message ?? `Invalid value, expected integer`,
          expected: value,
          received: value
        }
      ];
    }

    return [];
  };
