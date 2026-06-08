import { ValidationType, ValidationTypeValue, ValidatorOptions } from '../lib/types';

export let intersection = <A extends ValidationType<object>, B extends ValidationType<object>>(
  validators: [A, B],
  opts?: ValidatorOptions<ValidationTypeValue<A> & ValidationTypeValue<B>>
): ValidationType<ValidationTypeValue<A> & ValidationTypeValue<B>> => ({
  type: 'intersection',
  name: opts?.name,
  items: validators,
  description: opts?.description,
  examples: [],
  validate: value => {
    let fullValue: any = {};

    for (let validator of validators) {
      let result = validator.validate(value);
      if (!result.success) return result;

      fullValue = { ...fullValue, ...result.value };
    }

    return { success: true, value: fullValue };
  }
});
