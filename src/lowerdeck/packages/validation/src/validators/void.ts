import { ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let voidType = createValidator<void, ValidatorOptions<void>>('void', (opts, value) => {
  return { success: true, value: undefined };
});
