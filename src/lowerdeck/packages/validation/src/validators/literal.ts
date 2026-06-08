import { error } from '../lib/result';
import { ValidationType, ValidatorOptions } from '../lib/types';

export let literal = <A extends string | number | boolean>(
  value: A,
  opts?: ValidatorOptions<A>
): ValidationType<A> => ({
  type: 'literal',
  examples: [value],
  name: opts?.name,
  description: opts?.description,
  validate: input => {
    if (input != value) {
      return error([
        {
          code: 'invalid_literal',
          message: opts?.message ?? `Invalid input, expected ${value}, received ${input}`,
          received: input,
          expected: value
        }
      ]);
    }

    return { success: true, value };
  }
});
