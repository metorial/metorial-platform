import type { ValidationType, ValidationTypeValue, ValidatorOptions } from '../lib/types';

export let nullable = <A extends ValidationType<any>>(
  validator: A,
  opts?: ValidatorOptions<ValidationTypeValue<A> | null>
): ValidationType<ValidationTypeValue<A> | null> => ({
  ...validator,

  nullable: true,
  description: opts?.description ?? validator.description,
  validate: value => {
    if (value === null) {
      return { success: true, value };
    }

    return validator.validate(value);
  }
});
