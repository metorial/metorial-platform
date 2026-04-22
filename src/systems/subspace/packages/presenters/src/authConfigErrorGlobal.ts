import type {
  Provider,
  ProviderAuthConfigError,
  ProviderAuthConfigErrorGlobal
} from '@metorial-subspace/db';

export let authConfigErrorGlobalPresenter = async (
  error: ProviderAuthConfigErrorGlobal & {
    provider: Provider;
    firstOccurrence: ProviderAuthConfigError | null;
  }
) => ({
  object: 'auth_config.error_global',

  id: error.id,
  type: error.type,

  code: error.code,
  message: error.message,
  data: error.firstOccurrence?.payload || {},

  providerId: error.provider.id,

  occurrenceCount: error.occurrenceCount,

  createdAt: error.createdAt
});
