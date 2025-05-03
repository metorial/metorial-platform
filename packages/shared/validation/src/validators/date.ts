import { error } from '../lib/result';
import { ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let date = createValidator<Date, ValidatorOptions<Date>>('date', (opts, value) => {
  if (typeof value === 'string') {
    let date = new Date(value);

    if (!isNaN(date.getTime())) {
      value = date;
    }
  }

  if (!(value instanceof Date)) {
    return error([
      {
        code: 'invalid_type',
        message: opts.message ?? `Invalid input, expected a date, received ${typeof value}`,
        received: typeof value,
        expected: 'date'
      }
    ]);
  }

  return { success: true, value };
});
