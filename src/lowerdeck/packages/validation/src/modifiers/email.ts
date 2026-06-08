import { ValidationModifier } from '../lib/types';

let emailRegex = /^[\w+-]+(?:\.[\w+-]+)*@[A-Z0-9]+(?:(?:\.|-)[A-Z0-9]+)*\.[A-Z]{2,}$/i;

export let email =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!emailRegex.test(value)) {
      return [
        {
          code: 'invalid_email',
          message: opts?.message ?? 'Invalid email address'
        }
      ];
    }

    return [];
  };
