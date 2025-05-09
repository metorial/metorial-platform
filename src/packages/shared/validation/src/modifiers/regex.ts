import { ValidationModifier } from '../lib/types';

export let regex =
  (pattern: RegExp, opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!pattern.test(value)) {
      return [
        {
          code: 'invalid_regex',
          message: opts?.message ?? `Invalid regex, expected ${pattern}`,
          received: value
        }
      ];
    }

    return [];
  };
