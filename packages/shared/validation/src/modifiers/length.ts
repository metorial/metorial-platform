import { ValidationModifier } from '../lib/types';

export let length =
  (length: number): ValidationModifier<string> =>
  value => {
    if (value.length !== length) {
      return [
        {
          code: 'invalid_length',
          message: `Invalid length, expected ${length}`,
          expected: length,
          received: value.length
        }
      ];
    }

    return [];
  };

export let minLength =
  (length: number, opts?: { message?: string }): ValidationModifier<string | any[]> =>
  value => {
    if (value.length < length) {
      return [
        {
          code: 'invalid_min_length',
          message: opts?.message ?? `Invalid min length, expected ${length}`,
          expected: length,
          received: value.length,
          min: length
        }
      ];
    }

    return [];
  };

export let maxLength =
  (length: number, opts?: { message?: string }): ValidationModifier<string | any[]> =>
  value => {
    if (value.length > length) {
      return [
        {
          code: 'invalid_max_length',
          message: opts?.message ?? `Invalid max length, expected ${length}`,
          expected: length,
          received: value.length,
          max: length
        }
      ];
    }

    return [];
  };
