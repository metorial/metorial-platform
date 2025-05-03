import { ValidationModifier } from '../lib/types';

let colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export let color =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!colorRegex.test(value)) {
      return [
        {
          code: 'invalid_color',
          message: opts?.message ?? 'Invalid color'
        }
      ];
    }

    return [];
  };
