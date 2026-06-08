import { ValidationType, ValidationTypeValue, ValidatorOptions } from '../lib/types';

export let optional = <A extends ValidationType<any>>(
  validator: A,
  opts?: ValidatorOptions<ValidationTypeValue<A> | undefined>
): ValidationType<ValidationTypeValue<A> | undefined> => ({
  ...validator,
  optional: true,
  description: opts?.description ?? validator.description,
  validate: value => {
    if (value === undefined) {
      return { success: true, value };
    }

    return validator.validate(value);
  }
});
