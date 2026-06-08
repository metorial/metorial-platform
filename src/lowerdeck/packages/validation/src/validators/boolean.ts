import { error } from '../lib/result';
import { ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let boolean = createValidator<boolean, ValidatorOptions<boolean>>(
  'boolean',
  (opts, value) => {
    let serializedValue: boolean | undefined;

    if (typeof value == 'string') {
      if (value == 'true') {
        serializedValue = true;
      } else if (value == 'false') {
        serializedValue = false;
      }
    } else if (typeof value == 'boolean') {
      serializedValue = value;
    }

    if (serializedValue === undefined) {
      return error([
        {
          code: 'invalid_type',
          message:
            opts.message ?? `Invalid input, expected a boolean, received ${typeof value}`,
          received: typeof value,
          expected: 'boolean'
        }
      ]);
    }

    return { success: true, value: serializedValue };
  }
);
