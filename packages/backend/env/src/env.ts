import { ValidationType, ValidationTypeValue } from '@metorial/validation';

export let createValidatedEnv = <
  Env extends Record<string, Record<string, ValidationType<any>>>
>(
  env: Env
): {
  [K in keyof Env]: {
    [P in keyof Env[K]]: ValidationTypeValue<Env[K][P]>;
  };
} => {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      Object.fromEntries(
        Object.entries(value).map(([key, value]) => {
          let res = value.validate(process.env[key]);
          if (!res.success)
            throw new Error(`ENV VALIDATION: ${key} - ${res.errors[0].message}`);

          return [key, res.value];
        })
      )
    ])
  ) as any;
};
