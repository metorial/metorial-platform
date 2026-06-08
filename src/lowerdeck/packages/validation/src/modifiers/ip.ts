import { ValidationModifier } from '../lib/types';

let ipV4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
let ipV6Regex =
  /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

export let ip =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!ipV4Regex.test(value) && !ipV6Regex.test(value)) {
      return [
        {
          code: 'invalid_ip',
          message: opts?.message ?? 'Invalid ip address'
        }
      ];
    }

    return [];
  };

export let ipV4 =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!ipV4Regex.test(value)) {
      return [
        {
          code: 'invalid_ip_v4',
          message: opts?.message ?? 'Invalid ip v4 address'
        }
      ];
    }

    return [];
  };

export let ipV6 =
  (opts?: { message?: string }): ValidationModifier<string> =>
  value => {
    if (!ipV6Regex.test(value)) {
      return [
        {
          code: 'invalid_ip_v6',
          message: opts?.message ?? 'Invalid ip v6 address'
        }
      ];
    }

    return [];
  };
