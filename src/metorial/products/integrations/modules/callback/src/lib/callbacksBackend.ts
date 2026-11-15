import type { ProviderVariant } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import type { IProviderCallbacks } from '@metorial-subspace/provider-utils';

export let callbacksNotSupported = {
  code: 'callbacks_not_supported',
  message: 'This provider does not support callbacks.'
};

export let getCallbacksBackend = async (
  providerVariant: ProviderVariant
): Promise<IProviderCallbacks | null> => {
  let backend = await getBackend({ entity: providerVariant });
  return backend.callbacks ?? null;
};
