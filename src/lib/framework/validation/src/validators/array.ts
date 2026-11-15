import { error, success } from '../lib/result';
import type { ValidationType, ValidationTypeValue, ValidatorOptions } from '../lib/types';
import { createValidator } from '../lib/validator';

export let array = <Validator extends ValidationType<any>>(
  validator: Validator,
  opts?: ValidatorOptions<ValidationTypeValue<Validator>[]>
): ValidationType<ValidationTypeValue<Validator>[]> => ({
  ...createValidator<
    ValidationTypeValue<Validator>[],
    ValidatorOptions<ValidationTypeValue<Validator>[]>
  >('array', (opts, value) => {
    if (!Array.isArray(value)) {
      return error([
        {
          code: 'invalid_type',
          message: opts.message ?? `Invalid input, expected array, received ${typeof value}`,
          received: typeof value,
          expected: 'array'
        }
      ]);
    }

    let values: ValidationTypeValue<Validator>[] = [];

    for (let [key, val] of value.entries()) {
      let result = validator.validate(val);

      if (!result.success) {
        return error(
          result.errors.map(e => ({ ...e, path: [key.toString(), ...(e.path ?? [])] }))
        );
      }

      values.push(result.value);
    }

    return success(values);
  })(opts),
  items: validator,
  examples:
    opts?.examples ??
    (Array.isArray(validator.examples) ? validator.examples.map(v => [v, v]) : undefined)
});
