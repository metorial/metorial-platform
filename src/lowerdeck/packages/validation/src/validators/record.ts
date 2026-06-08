import { error, success } from '../lib/result';
import { ValidationType, ValidationTypeValue, ValidatorOptions } from '../lib/types';

export let record = <Validator extends ValidationType<any>>(
  validator: Validator,
  opts?: ValidatorOptions<Record<string, ValidationTypeValue<Validator>>>
): ValidationType<Record<string, ValidationTypeValue<Validator>>> => ({
  type: 'record',
  items: validator,
  name: opts?.name,
  description: opts?.description,
  examples: Array.isArray(validator.examples)
    ? [
        {
          key1: validator.examples[0]
        }
      ]
    : undefined,
  validate: value => {
    if (typeof value != 'object' || value === null || Array.isArray(value)) {
      return error([
        {
          code: 'invalid_type',
          message: `Invalid input, expected object`,
          received: value,
          expected: 'object'
        }
      ]);
    }

    let values: Record<string, ValidationTypeValue<Validator>> = {};

    for (let [key, val] of Object.entries(value)) {
      if (typeof key != 'string') {
        return error([
          {
            code: 'invalid_type',
            message: `Invalid input, expected object with string keys, received ${typeof key}`,
            received: key,
            expected: 'string'
          }
        ]);
      }

      let result = validator.validate(val);

      if (!result.success) {
        return error(result.errors.map(e => ({ ...e, path: [key, ...(e.path ?? [])] })));
      }

      values[key] = result.value;
    }

    return success(values);
  }
});
