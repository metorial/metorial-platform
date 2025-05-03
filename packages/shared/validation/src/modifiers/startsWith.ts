import { ValidationModifier } from '../lib/types';

export let startsWith =
  (prefix: string, opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!value.startsWith(prefix)) {
      return [
        {
          code: 'invalid_prefix',
          message: opts?.message ?? `Invalid prefix, expected ${prefix}`,
          expected: prefix,
          received: value
        }
      ];
    }

    return [];
  };
