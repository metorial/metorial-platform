import type { CustomProviderFrom } from '@metorial-subspace/db';

export type CustomProviderPresenterOptions = {
  includeEnv?: boolean;
};

export let presentCustomProviderFrom = (
  from: CustomProviderFrom,
  opts?: CustomProviderPresenterOptions
) => {
  if (from.type !== 'function') {
    return {
      object: 'custom_provider.from' as const,
      ...from
    };
  }

  let { env, ...rest } = from;

  if (opts?.includeEnv) {
    return {
      object: 'custom_provider.from' as const,
      ...rest,
      env
    };
  }

  return {
    object: 'custom_provider.from' as const,
    ...rest,
    env: {}
  };
};
