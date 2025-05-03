import { error } from '../lib/result';
import { ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let nullValue = createValidator<null, ValidatorOptions<null>>('null', (opts, value) => {
  if (value !== null) {
    return error([
      {
        code: 'invalid_type',
        message: opts.message ?? `Invalid input, expected null, received ${typeof value}`,
        received: typeof value,
        expected: 'null'
      }
    ]);
  }

  return { success: true, value: null };
});
