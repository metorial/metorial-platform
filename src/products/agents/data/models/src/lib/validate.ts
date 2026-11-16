import type { ValidationType } from '@lowerdeck/validation';

export class SourceValidationError extends Error {}

export let parseWith = <T>(schema: ValidationType<T>, value: unknown, context: string): T => {
  let result = schema.validate(value);
  if (result.success) return result.value;

  let details = result.errors
    .slice(0, 3)
    .map(error => `${(error.path ?? []).join('.') || '<root>'}: ${error.message}`)
    .join('; ');

  throw new SourceValidationError(`${context}: ${details}`);
};
