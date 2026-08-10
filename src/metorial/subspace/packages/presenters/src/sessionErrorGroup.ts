import type { Provider, SessionError, SessionErrorGroup } from '@metorial-subspace/db';

export let sessionErrorGroupPresenter = async (
  error: SessionErrorGroup & {
    provider: Provider | null;
    firstOccurrence: SessionError | null;
  }
) => {
  return {
    object: 'session.error_group',

    id: error.id,

    code: error.code,
    message: error.message,
    data: error.firstOccurrence?.payload || {},

    providerId: error.provider?.id || null,

    occurrenceCount: error.occurrenceCount,

    createdAt: error.createdAt
  };
};
