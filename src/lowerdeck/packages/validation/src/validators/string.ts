import { error } from '../lib/result';
import { ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let string = createValidator<string, ValidatorOptions<string>>(
  'string',
  (opts, value) => {
    if (typeof value != 'string') {
      return error([
        {
          code: 'invalid_type',
          message: opts.message ?? `Invalid input, expected string, received ${typeof value}`,
          received: typeof value,
          expected: 'string'
        }
      ]);
    }

    if (value.length > 100_000) {
      return error([
        {
          code: 'max_length',
          message: 'Input is too long'
        }
      ]);
    }

    return { success: true, value };
  }
);
