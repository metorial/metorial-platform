import { ValidationModifier } from '../lib/types';

export let includes =
  (substring: string, opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!value.includes(substring)) {
      return [
        {
          code: 'invalid_includes',
          message: opts?.message ?? `Invalid substring, expected ${substring}`,
          expected: substring,
          received: value
        }
      ];
    }

    return [];
  };

export let notIncludes =
  (substring: string, opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (value.includes(substring)) {
      return [
        {
          code: 'invalid_not_includes',
          message: opts?.message ?? `Invalid substring, expected not ${substring}`,
          expected: substring,
          received: value
        }
      ];
    }

    return [];
  };
