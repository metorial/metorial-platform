import { ValidationModifier } from '../lib/types';

export let equals =
  (
    expected: string | number | boolean,
    opts?: { message?: string }
  ): ValidationModifier<string> =>
  value => {
    if (value !== expected) {
      return [
        {
          code: 'invalid_equals',
          message: opts?.message ?? `Invalid value, expected ${expected}`,
          expected: expected,
          received: value
        }
      ];
    }

    return [];
  };

export let notEquals =
  (
    expected: string | number | boolean,
    opts?: { message?: string }
  ): ValidationModifier<string> =>
  value => {
    if (value === expected) {
      return [
        {
          code: 'invalid_not_equals',
          message: opts?.message ?? `Invalid value, expected not ${expected}`,
          expected: expected,
          received: value
        }
      ];
    }

    return [];
  };
