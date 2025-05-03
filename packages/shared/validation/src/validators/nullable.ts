import { ValidationType, ValidationTypeValue } from '../lib/types';

export let nullable = <A extends ValidationType<any>>(
  validator: A
): ValidationType<ValidationTypeValue<A> | null> => ({
  ...validator,

  nullable: true,
  validate: value => {
    if (value === null) {
      return { success: true, value };
    }

    return validator.validate(value);
  }
});
