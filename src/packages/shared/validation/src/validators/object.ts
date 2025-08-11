import { error, success } from '../lib/result';
import { ValidationType, ValidationTypeValue, ValidatorOptions } from '../lib/types';

type KeysWhichExtend<T, SelectedType> = {
  [key in keyof T]: SelectedType extends T[key] ? key : never;
}[keyof T];
type Optional<T> = Partial<Pick<T, KeysWhichExtend<T, undefined>>>;
type Required<T> = Omit<T, KeysWhichExtend<T, undefined>>;
export type UndefinedIsOptional<T> = Optional<T> & Required<T>;

export let object = <Validator extends { [key: string]: ValidationType<any> }>(
  shape: Validator,
  opts?: ValidatorOptions<Record<string, ValidationTypeValue<Validator>>>
): ValidationType<
  UndefinedIsOptional<{
    [key in keyof Validator]: ValidationTypeValue<Validator[key]>;
  }>
> => ({
  type: 'object',
  name: opts?.name,
  description: opts?.description,
  properties: shape,
  examples: [
    Object.fromEntries(
      Object.entries(shape)
        .map(([key, validator]) => {
          let example = validator.examples?.[0];
          // For nullable fields, if there's no example, don't include it
          // This prevents undefined from becoming {} in Object.fromEntries
          if (example === undefined && validator.nullable) {
            return null; // Will be filtered out
          }
          return [key, example];
        })
        .filter((entry): entry is [string, any] => entry !== null)
    )
  ] as any,
  validate: value => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return error([
        {
          code: 'invalid_type',
          message: `Invalid input, expected object, received ${typeof value}`,
          received: Array.isArray(value) ? 'array' : typeof value,
          expected: 'object'
        }
      ]);
    }

    let values: {
      [key in keyof Validator]: ValidationTypeValue<Validator[key]>;
    } = {} as any;

    for (let [key, validator] of Object.entries(shape)) {
      let result = validator.validate(value[key]);

      if (!result.success) {
        return error(result.errors.map(e => ({ ...e, path: [key, ...(e.path ?? [])] })));
      }

      values[key as keyof Validator] = result.value;
    }

    return success(values);
  }
});
