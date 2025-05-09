import { ValidationType, ValidationTypeValue } from '../lib/types';

export let optional = <A extends ValidationType<any>>(
  validator: A
): ValidationType<ValidationTypeValue<A> | undefined> => ({
  ...validator,

  optional: true,
  validate: value => {
    if (value === undefined) {
      return { success: true, value };
    }

    return validator.validate(value);
  }
});
