import { ValidationModifier } from '../lib/types';

let isoDateRegex = /^\d{4}-(0[1-9]|1[0-2])-([12]\d|0[1-9]|3[01])$/;
let isoDateTimeRegex =
  /^\d{4}-(0[1-9]|1[0-2])-([12]\d|0[1-9]|3[01])T(0[0-9]|1\d|2[0-3]):[0-5]\d$/;
let isoTimeRegex = /^(0[0-9]|1\d|2[0-3]):[0-5]\d$/;

export let isoDate =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!isoDateRegex.test(value)) {
      return [
        {
          code: 'invalid_iso_date',
          message: opts?.message ?? 'Invalid iso date'
        }
      ];
    }

    return [];
  };

export let isoDateTime =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!isoDateTimeRegex.test(value)) {
      return [
        {
          code: 'invalid_iso_date_time',
          message: opts?.message ?? 'Invalid iso date time'
        }
      ];
    }

    return [];
  };

export let isoTime =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!isoTimeRegex.test(value)) {
      return [
        {
          code: 'invalid_iso_time',
          message: opts?.message ?? 'Invalid iso time'
        }
      ];
    }

    return [];
  };
