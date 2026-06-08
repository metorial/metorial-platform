import { ValidationModifier } from '../lib/types';

export let endsWith =
  (suffix: string, opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!value.endsWith(suffix)) {
      return [
        {
          code: 'invalid_suffix',
          message: opts?.message ?? `Invalid suffix, expected ${suffix}`,
          expected: suffix,
          received: value
        }
      ];
    }

    return [];
  };
