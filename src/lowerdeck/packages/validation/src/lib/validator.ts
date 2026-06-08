import { error, success } from './result';
import {
  Preprocessor,
  Transformer,
  ValidationError,
  ValidationModifier,
  ValidationResult,
  ValidationType,
  ValidatorOptions
} from './types';

let preprocess = (preprocessors: Preprocessor[], value: any) => {
  return preprocessors.reduce((val, fn) => fn(val), value);
};

let modify = <T>(modifiers: ValidationModifier<T>[], value: T) => {
  return modifiers.reduce((errors, fn) => errors.concat(fn(value)), [] as ValidationError[]);
};

let transform = <T>(transformers: Transformer<T>[], value: T) => {
  return transformers.reduce((val, fn) => fn(val), value);
};

export let createValidator =
  <Type, Opts extends ValidatorOptions<Type>>(
    type: string,
    handler: (opts: Opts, value: any) => ValidationResult<Type>
  ) =>
  (opts?: Opts): ValidationType<Type> => ({
    validate: rawValue => {
      try {
        let value =
          !opts?.preprocessors || !opts?.preprocessors.length
            ? rawValue
            : preprocess(opts?.preprocessors, rawValue);

        let handlerRes = handler(opts ?? ({} as any), value);
        if (!handlerRes.success) return handlerRes;

        let modifierErrors =
          !opts?.modifiers || !opts?.modifiers.length ? [] : modify(opts?.modifiers, value);
        if (modifierErrors.length) return error(modifierErrors);

        return success(
          !opts?.transformers || !opts?.transformers.length
            ? handlerRes.value
            : transform(opts?.transformers, handlerRes.value)
        );
      } catch (err) {
        return error([
          {
            code: 'invalid_type',
            message: opts?.message ?? 'Unable to validate value'
          }
        ]);
      }
    },
    examples: opts?.examples ?? [],
    type,
    name: opts?.name,
    description: opts?.description,
    hidden: !!opts?.hidden
  });
