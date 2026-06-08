import { error } from '../lib/result';
import { ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let number = createValidator<number, ValidatorOptions<number>>(
  'number',
  (opts, value) => {
    let number = typeof value == 'string' ? parseFloat(value) : value;

    if (typeof number != 'number' || isNaN(number)) {
      return error([
        {
          code: 'invalid_type',
          message: opts.message ?? `Invalid input, expected number, received ${typeof value}`,
          received: typeof value,
          expected: 'number'
        }
      ]);
    }

    return { success: true, value: number };
  }
);
