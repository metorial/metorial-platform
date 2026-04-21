import type { AuthConfigError, AuthConfigErrorGlobal, Provider } from '@metorial-subspace/db';

export let authConfigErrorGlobalPresenter = async (
  error: AuthConfigErrorGlobal & {
    provider: Provider;
    firstOccurrence: AuthConfigError | null;
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
