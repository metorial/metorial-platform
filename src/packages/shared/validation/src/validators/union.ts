import { error } from '../lib/result';
import {
  ValidationError,
  ValidationType,
  ValidationTypeValue,
  ValidatorOptions
} from '../lib/types';

export let union = <
  A extends ValidationType<any>,
  B extends ValidationType<any>,
  Rest extends ValidationType<any>[]
>(
  validators: [A, B, ...Rest],
  opts?: ValidatorOptions<
    ValidationTypeValue<A> | ValidationTypeValue<B> | ValidationTypeValue<Rest[number]>
  >
): ValidationType<
  ValidationTypeValue<A> | ValidationTypeValue<B> | ValidationTypeValue<Rest[number]>
> => ({
  type: 'union',
  name: opts?.name,
  items: validators,
  description: opts?.description,
  examples: validators.flatMap(v => v.examples || []),
  validate: value => {
    let errors: ValidationError[] = [];

    for (let validator of validators) {
      let result = validator.validate(value);
      if (result.success) return result;

      errors.push(...result.errors);
    }

    return error(errors);
  }
});
