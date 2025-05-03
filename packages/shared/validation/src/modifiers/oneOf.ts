import { ValidationModifier } from '../lib/types';

export let oneOf =
  (allowed: string[], opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!allowed.includes(value)) {
      return [
        {
          code: 'invalid_value',
          message: opts?.message ?? `Value must be one of: ${allowed.join(', ')}`
        }
      ];
    }

    return [];
  };
