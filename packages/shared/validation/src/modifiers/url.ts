import { ValidationModifier } from '../lib/types';

export let url =
  (opts?: { message?: string; hostnames?: string[] }): ValidationModifier<string> =>
  value => {
    try {
      let url = new URL(value);

      if (opts?.hostnames && !opts.hostnames.includes(url.hostname)) {
        return [
          {
            code: 'invalid_hostname',
            message: opts?.message ?? `Invalid hostname`,
            expected: opts?.hostnames,
            received: url.hostname
          }
        ];
      }

      return [];
    } catch (err) {
      return [
        {
          code: 'invalid_url',
          message: opts?.message ?? `Invalid URL`,
          received: value
        }
      ];
    }
  };
