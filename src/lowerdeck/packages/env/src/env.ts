import type { ValidationType, ValidationTypeValue } from '@lowerdeck/validation';

export let isOfflineMode = () => process.env.LOWERDECK_OFFLINE == '1';

let resolveOfflinePlaceholder = (key: string, validator: ValidationType<any>) => {
  let looksLikeUrl = /(_URL|_URI|_ENDPOINT|_ORIGIN)$/.test(key);

  let candidates = [
    ...(validator.examples ?? []),
    ...(looksLikeUrl ? ['http://127.0.0.1:1'] : []),
    `offline-${key}`,
    'http://127.0.0.1:1',
    'offline@offline.invalid',
    '0',
    '1',
    'false',
    'true'
  ];

  for (let candidate of candidates) {
    let res = validator.validate(candidate);
    if (res.success) return res;
  }

  return undefined;
};

export let createValidatedEnv = <
  Env extends Record<string, Record<string, ValidationType<any>>>
>(
  env: Env
): {
  [K in keyof Env]: {
    [P in keyof Env[K]]: ValidationTypeValue<Env[K][P]>;
  };
} => {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      Object.fromEntries(
        Object.entries(value).map(([key, value]) => {
          let res = value.validate(process.env[key]);
          if (!res.success && isOfflineMode()) {
            res = resolveOfflinePlaceholder(key, value) ?? res;
          }

          if (!res.success)
            throw new Error(`ENV VALIDATION: ${key} - ${res.errors[0]?.message ?? 'invalid'}`);

          return [key, res.value];
        })
      )
    ])
  ) as any;
};
