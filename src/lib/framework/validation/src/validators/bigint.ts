import { error } from '../lib/result';
import type { ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let bigint = createValidator<bigint, ValidatorOptions<bigint>>(
  'bigint',
  (opts, value) => {
    if (typeof value != 'bigint') {
      return error([
        {
          code: 'invalid_type',
          message: opts.message ?? `Invalid input, expected bigint, received ${typeof value}`,
          received: typeof value,
          expected: 'bigint'
        }
      ]);
    }

    return { success: true, value };
  }
);
