import { ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let any = createValidator<any, ValidatorOptions<any>>('any', (opts, value) => {
  return { success: true, value };
});

export let typedAny = <T>(name: string) =>
  createValidator<T, ValidatorOptions<T>>(name, (opts, value) => {
    return { success: true, value };
  })();
